export type State = {
    [key: string]: any
}

export type Props = {
    [key: string]: any
}

export type Drivers = {
    [key: string]: any
}

export type SubState = {
    [key: string]: State
}


export type Reducer = ReducerFn | State | null

export type ReducerFn = (state: State) => State

export enum HttpStatus {
    FRESH = 'fresh',
    PENDING = 'pending',
    FULFILLED = 'fulfilled'
}
