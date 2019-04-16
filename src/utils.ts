import { tap, map, distinctUntilChanged, switchMap } from 'rxjs/operators'
import { isPlainObject, pick } from 'lodash'
import { from, merge, of } from 'rxjs'

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

export function _xhr(func: (...args: any[]) => Promise<any> | any) {
    return switchMap((...args: any[]) => {
        const resolve = func(...args)
        if (resolve instanceof Promise) {
            return merge(
                of([undefined, true]),
                from(resolve).pipe(map(data => [data, false])),
            )
        }
        return of(resolve)
    })
}

export function _await(func: (...args: any[]) => Promise<any> | any) {
    return switchMap((...args: any[]) => {
        const resolve = func(...args)
        if (resolve instanceof Promise) {
            return from(resolve)
        }
        return resolve
    })
}

export function _shouldUpdate(compare: (previous: any, current: any) => boolean) {
    return distinctUntilChanged((prev, cur) => !compare(prev, cur))
}

export function _pickByKey(...args: any[]) {
    return map(value => {
        if (!isPlainObject(value)) {
            throw new TypeError('pickByKey can only use for Object value')
        }
        return pick(value, ...args)
    })
}

export function _id() {
    let id = 0
    return () => id++
}

