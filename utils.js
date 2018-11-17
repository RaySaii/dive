import React from 'react'
import {get, isEmpty} from 'lodash'
import {IHttpComponent} from './dist/HttpComponent'
import _shallowEqual from './dist/shallowEqual'
import _HTTP, {_fromHttp, _fromPureHttp} from './dist/http'
import {_And, _Get, _Map, _Or} from './dist/utils'


export const And = _And

export const Or = _Or

export const Map = _Map

export const Get = _Get

export const HttpComponent = IHttpComponent

export const shallowEqual = _shallowEqual

export const HTTP = _HTTP

export const fromHttp = _fromHttp

export const fromPureHttp = _fromPureHttp

