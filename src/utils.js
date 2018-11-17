import React from 'react'
import {get, isEmpty} from 'lodash'

/**
 * @return {boolean}
 */
export function _And(...rest) {
  for (let item of rest) {
    if (!item) return false
  }
  return true
}

/**
 * @return {boolean}
 */
export function _Or(...rest) {
  for (let item of rest) {
    if (!!item) return true
  }
  return false
}

export function _Get({ target, path, children }) {
  return get(target, path) ? children(get(target, path)) : null
}

export function _Map({ target, id, children }) {
  if (isEmpty(target)) return null
  let result = []
  for (let key in target) {
    let cur = children(target[key], id ? target[key][id] : key)
    result.push(cur)
  }
  return result
}



