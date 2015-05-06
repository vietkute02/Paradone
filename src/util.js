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
 * @flow weak
 */
'use strict'

/**
 * @module util
 * @desc Contains useful functions for developpers
 */

/**
 * Returns a shallow copy of an array with its elements shuffled
 *
 * @function module:util~shuffleArray
 * @template T
 * @param {Array.<T>} array - Source array
 * @return {Array.<T>} Shuffled elements in a shallow copy
 */
export function shuffleArray(array) {
  var i, j, temp
  var result = array.slice()
  for(i = array.length - 1; i > 0; i--) {
    j = Math.floor(Math.random() * (i + 1))
    temp = result[i]
    result[i] = result[j]
    result[j] = temp
  }
  return result
}

/**
 * Returns a shallow copy of an array with its elements sorted
 *
 * @function module:util~shallowSort
 * @template T
 * @param {(T,T) => boolean} sortFunction - Compare two elements
 * @param {Array.<T>} array - Source array
 * @return {Array.<T>} Sorted elements in a shallow copy
 */
export function shallowSort(sortFunction, array) {
  return array.slice().sort(sortFunction)
}

/**
 * Returns the URL of the a file from a relative path. Can be relative to the
 * root of the website if the path starts with '/' otherwise it will be relative
 * to the current file. It is assumed that URL ending in '/' are for directories
 *
 * @function module:util~getUrl
 * @param {string} pathToFile - Relative path for the file
 * @return {string} Full URL
 */
export function getURL(pathToFile) {
  var path = window.location.pathname
  var origin = window.location.origin

  if(pathToFile.charAt(0) === '/') {
    return origin + pathToFile
  }

  if(path.charAt(path.length - 1) !== '/') {
    path = path.replace(/[^/]*$/, '')
  }

  if(pathToFile.slice(0, 2) === './') {
    pathToFile = pathToFile.slice(2)
  }

  return origin + path + pathToFile
}

/**
 * Return the result of a XHR as a promise. If the XHR succeed, the resolve
 * function of the promise will have the file requested as first parameter.
 *
 * @function module:util~getRemoteFile
 * @param {string} fileUrl - url of the file to be downloaded
 * @param {string} [responseType='blob'] - Type returned by the server
 * @param {string} [range=''] - If a range should be requested instead of the
 *        entire file
 * @return {Promise} a new Promise holding the file's URL and ArrayBuffer
 */
export function getRemoteFile(fileUrl, responseType = 'blob', range = '') {
  const DEFAULT_STATUS = 200
  const RANGE_STATUS = 206

  return new Promise(function(resolve, reject) {
    var status
    var xhr = new XMLHttpRequest()
    xhr.open('GET', fileUrl, true)
    xhr.responseType = responseType

    if(range !== '') {
      xhr.setRequestHeader('Range', 'bytes=' + range)
      status = RANGE_STATUS
    } else {
      status = DEFAULT_STATUS
    }

    xhr.onreadystatechange = function() {
      if(this.readyState === this.DONE) {
        if(this.status === status) {
          resolve(this.response)
        } else {
          console.error('Download of ' + fileUrl + ' failed')
          reject(this)
        }
      }
    }

    xhr.send()
  })
}

/**
 * Checks if an element is contained in the given array
 *
 * @function module:util~contains
 * @template T
 * @param {T} element - Element to check
 * @param {Array.<T>} array - Array to match element against
 * @return {boolean} Whether element is in array or not
 */
export function contains(element, array) {
  return array.indexOf(element) >= 0
}

/**
 * Checks the properties contained in the message object
 *
 * @function module:util~messageIsValid
 * @param {Message} msg - Message needing validation
 * @return {boolean} true if the message is valid
 */
export function messageIsValid(msg) {
  var check = function(params) {
    return params.map(param => {
      if(!msg.hasOwnProperty(param) || typeof msg[param] === 'undefined') {
        console.error('Message#' + param + ' is missing')
        return false
      }
      return true
    }).reduce(((acc, elt) => acc && elt), true)
  }

  var defaultParams = ['type', 'from', 'to']
  var additionalParams = [
    { types: ['request-peer', 'answer', 'icecandidate', 'offer'],
      params: ['ttl', 'forwardBy']}
  ]
  var originals = check(defaultParams)
  var additionals = additionalParams.map(add => {
    if(contains(msg.type, add.types)) {
      return check(add.params)
    }
    return true
  }).reduce(((acc, elt) => acc && elt), true)

  return originals && additionals
}

/**
 * Use only for checking message size not for actual computation
 *
 * @param {string} string
 * @return {number} The length in bytes of the string
 * @deprecated
 */
export function byteCount(string) {
  return window.unescape(encodeURIComponent(string)).length
}
