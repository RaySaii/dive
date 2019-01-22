import { tap } from 'rxjs/operators'

export function _And(...rest: any[]): boolean {
    for (let item of rest) {
        if (!item) return false
    }
    return true
}

export function _Or(...rest: any[]): boolean {
    for (let item of rest) {
        if (!!item) return true
    }
    return false
}


export function _debug(message: string, style = '') {
    const isDEV = process.env.NODE_ENV == 'development'
    return tap(
        nextValue => {
            if (isDEV) {
                style
                    ? console.log(message, style, nextValue)
                    : console.log(message, nextValue)
            }
        },
        error => {
            if (isDEV) {
                console.error(message, error)
            }
        },
        () => {
            if (isDEV) {
                console.log('Observable completed - ', message)
            }
        },
    )
}


