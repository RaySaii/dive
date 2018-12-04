import {catchError, share, switchMap, tap, map} from 'rxjs/operators'
import {EMPTY, from, of, merge, Subject} from 'rxjs'


class IHTTP {
  constructor() {
    this.RESOPNSE$ = new Subject()

    this.fromHttp = (promise) => {
      const httpWithErrorHandle = merge(
          of({ status: 'pending', data: {} }),
          from(promise)
              .pipe(
                  catchError(err => {
                    console.error(err)
                    return EMPTY
                  }),
                  map(data => ({ data, status: 'fulfilled' })),
              ),
      )
      this.RESOPNSE$.next(httpWithErrorHandle)
      return httpWithErrorHandle
    }

    this.fromPureHttp = (promise) => {
      const httpWithErrorHandle = from(promise)
          .pipe(
              catchError(err => {
                console.error(err)
                return EMPTY
              }),
          )
      this.RESOPNSE$.next(httpWithErrorHandle)
      return httpWithErrorHandle
    }
  }



}

const HTTP = new IHTTP()
export default HTTP
export const _fromHttp = HTTP.fromHttp
export const _fromPureHttp = HTTP.fromPureHttp
