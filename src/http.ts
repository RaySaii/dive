import { catchError, map } from 'rxjs/operators'
import { EMPTY, from, of, merge, Subject, Observable } from 'rxjs'
import { HttpStatus } from './type'


type IHttpResponse = {
    data: any
    status: HttpStatus
}

class IHTTP {
    RESOPNSE$$: Subject<Observable<IHttpResponse> | Observable<never>>
    fromHttp: (promise: Promise<any>) => Observable<IHttpResponse>
    fromPureHttp: (promise: Promise<any>) => Observable<any>

    constructor() {
        this.RESOPNSE$$ = new Subject()

        this.fromHttp = (promise) => {
            const httpWithErrorHandle = merge(
                of({ status: HttpStatus.PENDING, data: undefined }),
                from(promise)
                    .pipe(
                        catchError(err => {
                            console.error(err)
                            return EMPTY
                        }),
                        map(data => ({ data, status: HttpStatus.FULFILLED })),
                    ),
            )
            this.RESOPNSE$$.next(httpWithErrorHandle)
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
            this.RESOPNSE$$.next(httpWithErrorHandle)
            return httpWithErrorHandle
        }
    }


}

export default IHTTP
