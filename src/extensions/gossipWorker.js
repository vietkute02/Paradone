/*
 * Copyright 2015 Paradone
 *
 * This file is part of Paradone <https://paradone.github.io>
 *
 * Paradone is free software: you can redistribute it and/or modify it under
 * the terms of the GNU Affero General Public License as published by the
 * Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version.
 *
 * Paradone is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public
 * License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Paradone.  If not, see <http://www.gnu.org/licenses/>.
 *
 * @flow
 */
'use strict'

import MessageEmitter from '../messageEmitter.js'
import Algo from './gossipRPS.js'
export { GossipWorker as default }

/**
 * Sends the view to the main thread
 */
var updateOutsideView = function() {
  this.send({
    type: 'view-update',
    from: this.id,
    to: this.id,
    data: this.view
  })
}

/**
 * Active exchange of views with a selected peers. We have to select one peer
 * (oldest or randomly), generate a view for this remote peer, send the view,
 * wait for the answer and finally generate a new merged view.
 *
 * @param {View} view - Base view used to generate information for the peer
 */
var activeThread = function() {
  var view = this.view

  if(view.length === 0) {
    return
  }
  // TODO Replace with a contact bucket
  var distantId = this.algo.selectRemotePeer('random', view)
  var sentBuffer = this.algo.genBuffer('active', distantId, view)
  this.on('gossip:answer-exchange', function callback(message) {
    // TODO Depends on push/pull policy
    /* The catch here is concurrent update of the view elements. The algorithm
     * states that the view should be reordered each time a new buffer is
     * generated: Swapped nodes at the beginning, oldest nodes at the end and
     * the rest randomly in between. This allows for simple and efficient view
     * pruning (the size of the view must be constant).
     *
     * If the node receives a request from an other distant node while waiting
     * for this callback to be called, the view will be updated with the value
     * of the other received buffer and the "swapped nodes" located at the
     * beginning of the view will not be the swapped nodes of the exchange
     * happening in this particular callback.
     *
     * The oldest nodes present in the view can be categorised and removed
     * independently of the sent and received buffers. The "problem" is only
     * for swapped nodes.
     *
     * The tricky bits are done in the `mergeView` function.
     */
    if(message.from === distantId) {
      // Generate the new view
      view = this.algo.mergeView(message.data, sentBuffer, this.view)
      // The exchange is complete the view gets older and is saved
      this.view = this.algo.increaseAge(view)
      // We don't need this callback anymore
      this.removeListener('gossip:answer-exchange', callback)
      // DEBUG Update the view outside
      updateOutsideView.call(this)
    }
  }.bind(this))
  // Don't forget to send the generated extract to the selected peer
  this.send({
    type: 'gossip:request-exchange',
    from: this.id,
    to: distantId,
    data: sentBuffer,
    ttl: 3,
    forwardBy: []
  })
}

/**
 * Reception of the remote's view subset. We generate an extract to return to
 * the remote peer and merge everything with the view.
 *
 * @param {Message} message
 */
var passiveThread = function(message) {
  var sentBuffer = this.algo.genBuffer('passive', message.from, this.view)
  this.view = this.algo.increaseAge(
    this.algo.mergeView(message.data, sentBuffer, this.view))
  this.send({
    type: 'gossip:answer-exchange',
    from: this.id,
    to: message.from,
    data: sentBuffer,
    ttl: 0,
    forwardBy: []
  })
  updateOutsideView.call(this)
}

/**
 * @class GossipWorker
 * @property {View} view - Current view of the peer
 * @property {GossipAlgorithm} algo - Gossip algorithm used to compute the new
 *           view and share node descriptors with other peers.
 */
function GossipWorker() {
  MessageEmitter.call(this)
  this.view = []

  this.on('init', message => {
    let parameters = message.data
    this.options = parameters

    if(parameters.hasOwnProperty('gossipPeriod')) {
      this.gossipPeriod = parameters.gossipPeriod
    } else {
      this.gossipPeriod = 2500
    }
  })
  // As soon as the first view is received, start the active thread
  this.on('first-view', message => {
    this.id = message.data.id
    this.view = message.data.view
    this.algo = new Algo(this.id, this.options)

    self.setInterval(activeThread.bind(this), this.gossipPeriod)
  })
  this.on('gossip:request-exchange', passiveThread.bind(this))
}

GossipWorker.prototype = Object.create(MessageEmitter.prototype)

/**
 * Sends the message to the outside world
 *
 * @function GossipWorker#send
 * @param {Message} message - Message to send
 */
GossipWorker.prototype.send = function(message) {
  self.postMessage(message)
}

self.mediator = new GossipWorker()
// Directly forward messages down
self.addEventListener('message', e => {
  var message = e.data
  self.mediator.post(message)
})
