import React from 'react'
import {get, isEmpty} from 'lodash'
import {IHttpComponent} from './HttpComponent'
import _shallowEqual from './shallowEqual'
import _HTTP, {fromHttp as _fromHttp, fromPureHttp as _fromPureHttp} from './http'

/**
 * @return {boolean}
 */
export function And(...rest) {
  for (let item of rest) {
    if (!item) return false
  }
  return true
}

/**
 * @return {boolean}
 */
export function Or(...rest) {
  for (let item of rest) {
    if (!!item) return true
  }
  return false
}

export function Get({ target, path, children }) {
  return get(target, path) ? children(get(target, path)) : null
}

export function Map({ target, id, children }) {
  if (isEmpty(target)) return null
  let result = []
  for (let key in target) {
    let cur = children(target[key], key)
    result.push(cur)
  }
  return result
}


export const HttpComponent = IHttpComponent

export const shallowEqual = _shallowEqual

export const HTTP = _HTTP

export const fromHttp = _fromHttp

export const fromPureHttp = _fromPureHttp

