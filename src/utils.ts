import { tap, map, distinctUntilChanged, switchMap, withLatestFrom } from 'rxjs/operators'
import { isPlainObject, pick } from 'lodash'
import { from, isObservable, merge, Observable, of } from 'rxjs'

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
        if (isObservable(resolve)) return resolve
        return of([resolve, false])
    })
}

export function _wait(func: (...args: any[]) => Promise<any> | any) {
    return switchMap((...args: any[]) => {
        const resolve = func(...args)
        if (resolve instanceof Promise) {
            return from(resolve)
        }
        if (isObservable(resolve)) return resolve
        return of(resolve)
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

export function _effectWith(...args: any[]) {

    if (typeof args[args.length - 1] !== 'function') {
        throw new TypeError('the last argument must be a function')
    }

    let project = args.pop()

    return (source: Observable<any>) => Observable.create((subscriber: any) => {
        const subscription = source.pipe(
            withLatestFrom(...args, (..._args: any[]) => {
                project(..._args)
                return _args[0]
            }),
        ).subscribe((value: any) => {
                try {
                    subscriber.next(value)
                } catch (err) {
                    subscriber.error(err)
                }
            },
            (err: Error) => subscriber.error(err),
            () => subscriber.complete(),
        )

        return subscription
    })
}

export function _xhrWith(...args: any[]) {

    if (typeof args[args.length - 1] !== 'function') {
        throw new TypeError('the last argument must be a function')
    }

    let project = args.pop()

    return (source: Observable<any>) => Observable.create((subscriber: any) => {
        const subscription = source.pipe(
            withLatestFrom(...args),
            _xhr(_arr => project(..._arr)),
        ).subscribe((value: any) => {
                try {
                    subscriber.next(value)
                } catch (err) {
                    subscriber.error(err)
                }
            },
            (err: Error) => subscriber.error(err),
            () => subscriber.complete(),
        )

        return subscription
    })
}


export function _waitWith(...args: any[]) {

    if (typeof args[args.length - 1] !== 'function') {
        throw new TypeError('the last argument must be a function')
    }

    let project = args.pop()

    return (source: Observable<any>) => Observable.create((subscriber: any) => {
        const subscription = source.pipe(
            withLatestFrom(...args),
            _wait(_arr => project(..._arr)),
        ).subscribe((value: any) => {
                try {
                    subscriber.next(value)
                } catch (err) {
                    subscriber.error(err)
                }
            },
            (err: Error) => subscriber.error(err),
            () => subscriber.complete(),
        )

        return subscription
    })
}

export function _subscribeWith(...args: any[]) {
    if (typeof args[args.length - 1] !== 'function') {
        throw new TypeError('the last argument must be a function')
    }

    let project = args.pop()


    // @ts-ignore
    return this.pipe(
        withLatestFrom(...args),
    ).subscribe((arr: any[]) => {
        project(...arr)
    })
}
