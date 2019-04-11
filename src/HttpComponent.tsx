import React, { ReactElement } from 'react'
import { isEmpty } from 'lodash'
import { HttpStatus } from './type'
import { _And } from './utils'

type IProps = {
    status?: HttpStatus,
    data: any,
    empty?: null | ReactElement<any>,
    loading?: null | ReactElement<any>,
    render: (data: any) => ReactElement<any>,
}
/** @deprecated */
export function IHttpComponent(props: IProps) {
    const { status, data, empty, loading, render } = props
    return (
        <>
            {status == HttpStatus.FRESH && null}
            {status == HttpStatus.PENDING && loading}
            {_And(status == HttpStatus.FULFILLED, isEmpty(data)) && empty}
            {_And(!status || status == HttpStatus.FULFILLED, !isEmpty(data)) && render(data)}
        </>
    )
}

