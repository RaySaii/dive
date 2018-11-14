import React from 'react';
import {And} from './utils'
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
            {And(status == 'fulfilled', isEmpty(data)) && empty}
            {And(status == 'fulfilled', !isEmpty(data)) && render(data)}
        </>
    )
}

