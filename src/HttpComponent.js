import React from 'react'
import {_And} from './utils'
import {isEmpty} from 'lodash'

const defaultRender = () => {
}

export function IHttpComponent({
                                 status,
                                 data,
                                 empty = null,
                                 loading = null,
                                 render = defaultRender,
                               }) {
  return (
      <>
        {status == 'fresh' && null}
        {status == 'pending' && loading}
        {_And(status == 'fulfilled', isEmpty(data)) && empty}
        {_And(!status || status == 'fulfilled', !isEmpty(data)) && render(data)}
      </>
  )
}

