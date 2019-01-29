import { tap, filter } from 'rxjs/operators'
import { Observable } from 'rxjs'
import { cloneDeep } from 'lodash'

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


export function _shouldUpdate(compare: (object: { previous: any, current: any }) => boolean) {
    // notice that we return a function here
    let prev: any
    let init: boolean = true
    return (source: Observable<any>) => Observable.create((subscriber: any) => {
        const subscription = source.pipe(
            filter((value) => {
                if (init) {
                    init = false
                    prev = value
                    return true
                }
                let temp = cloneDeep(prev)
                prev = value
                return compare({ previous: temp, current: value })
            }),
        ).subscribe(value => {
                try {
                    subscriber.next(value)
                } catch (err) {
                    subscriber.error(err)
                }
            },
            err => subscriber.error(err),
            () => subscriber.complete(),
        )

        return subscription
    })
}

