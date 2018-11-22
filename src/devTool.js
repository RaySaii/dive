import React from 'react'
import ReactDOM from 'react-dom'
import styled from 'styled-components'
import {map, switchMap} from 'rxjs/operators'
import {devGlobalState$, actions$} from './globalState'
import subState$, {change$} from './subState'
import JSONTree from 'react-json-view'
import {isEmpty, omit, omitBy} from 'lodash'
import {ResizableBox} from 'react-resizable'
import 'react-resizable/css/styles.css'
import diff from 'shallow-diff'
import {EMPTY, of} from 'rxjs'

const Box = styled(ResizableBox)`
  background: #f3f5f7;
  position: fixed;
  top:0;
  left:0;
  z-index: 1000000;
  transition: all 0.1s linear;
  transform:${props => props.show=='true' ? 'translateX(0)' : 'translateX(-100%)'};
  .react-resizable-handle{
    bottom: 80px;
    right: 0;
    cursor:e-resize;
    background-size: 10px;
    background-color: #6ec0e6;
  }
  box-shadow: 1px 0 20px rgba(0, 0, 0, 0.1);
  .tab_bar{
    background: white;
    height: 55px;
    display: flex;
    cursor: pointer;
          z-index: 11;
          border-bottom: 1px solid #d8d8d8;
          position: relative;
    .bar{
      position: relative;
      width: 100px;
      height: 100%;
      text-align: center;
      font-size: 20px;
      padding-top: 15px;
    }
    .left,.right{
      width: 30px;
      height: 30px;
      background: #6ec0e6;
      position: absolute;
      top:13px;
      color:white;
      text-align: center;
      line-height: 30px;
    }
    .left{
      right:10px;
    }
    .right{
      right: -30px;
       box-shadow: 1px 0 20px rgba(0, 0, 0, 0.1);
       opacity: 0.3;
       &:hover{
        opacity: 1;
       }
    }
  }
  .content{
    position: relative;
    height:calc(100% - 55px);
    .zIndex{
    width:100%;
     padding: 20px;
     overflow-y: auto;
     height: calc(100% - 80px);
     background: #f3f5f7;
    }
    .action_item{
    overflow-x: auto;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    border: 1px solid #d8d8d8;
    background: white;
    }
  }
`
const Active = styled.div`
  width: 100%;  
  height: 11px !important;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: absolute !important;
  bottom:-7px !important;
  div{
    width: 100%;
    height: 4px;
    background: #6ec0e6 ;
  }
`

function ActiveBar() {
  return (
      <Active>
        <div/>
        <img
            src="data:image/svg+xml;utf8,&lt;svg width=&quot;12&quot; height=&quot;7&quot; viewBox=&quot;0 0 12 7&quot; version=&quot;1.1&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot; xmlns:xlink=&quot;http://www.w3.org/1999/xlink&quot;&gt;&#10;&lt;title&gt;Polygon&lt;/title&gt;&#10;&lt;desc&gt;Created using Figma&lt;/desc&gt;&#10;&lt;g id=&quot;Canvas&quot; transform=&quot;translate(-2344 -40)&quot;&gt;&#10;&lt;g id=&quot;Polygon&quot;&gt;&#10;&lt;use xlink:href=&quot;%23path0_fill&quot; transform=&quot;matrix(-1 9.54098e-18 -9.54098e-18 -1 2356 47)&quot; fill=&quot;%236EC0E6&quot;/&gt;&#10;&lt;/g&gt;&#10;&lt;/g&gt;&#10;&lt;defs&gt;&#10;&lt;path id=&quot;path0_fill&quot; d=&quot;M 6.05481 0L 12 7L 0 7L 6.05481 0Z&quot;/&gt;&#10;&lt;/defs&gt;&#10;&lt;/svg&gt;&#10;"
        />
      </Active>
  )
}

class DevTool extends React.Component {
  state = {
    key: 'global',
    global: [],
    subs: [],
    actions: [],
    ignore: [],
    show: true,
  }

  componentDidMount() {
    devGlobalState$.subscribe(global => {
      return this.setState(state => ({ global: state.global.concat(global) }))
    })
    subState$.subscribe(subs => this.setState(state => ({ subs: state.subs.concat(subs) })))
    actions$.pipe(
        switchMap(({ state, nextState, id }) => {
          if (state !== nextState) {
            let difference = diff(state, nextState)
            difference = omitBy(difference, isEmpty)
            difference = omit(difference, 'unchanged')
            let action = {}
            Object.keys(difference).forEach(key => {
              difference[key].forEach(prop => {
                action[key] = action[key] || {}
                action[key][prop] = nextState[prop]
              })
            })
            return of(isEmpty(action) ? id + ' action but unchanged' : { [id]: action })
          }
          return EMPTY
        }),
    )
        .subscribe(action => this.setState(state => ({ actions: state.actions.concat(action) })))
  }

  select = key => {
    this.setState({ key })
  }

  render() {
    const { show, key, subs, global, actions } = this.state
    return <Box width={408}
                height={window.screen.availHeight}
                minConstraints={[408, window.screen.availHeight]}
                show={show.toString()}
                axis={'x'}>
      <div className={'tab_bar'}>
        <div className={'bar'} onClick={() => this.select('global')}>
          Global
          {key == 'global' && <ActiveBar/>}
        </div>
        <div className={'bar'} onClick={() => this.select('subs')}>
          Subs
          {key == 'subs' && <ActiveBar/>}
        </div>
        <div className={'bar'} onClick={() => this.select('actions')}>
          Actions
          {key == 'actions' && <ActiveBar/>}
        </div>
        {!show && <div onClick={() => this.setState({ show: true })} className={'right'}> {'>'} </div>}
        <div onClick={() => this.setState({ show: false })} className={'left'}> {'<'} </div>
      </div>
      <div className={'content'}>
        {
          global && <div className={'zIndex'} style={{
            width: key == 'global' ? null : 0,
            height: key == 'global' ? null : 0,
            padding: key == 'global' ? null : 0,
            overflow: key == 'global' ? 'auto' : 'hidden',
          }}>
            {
              global.map((item, index) => {
                return <div key={index} className={'action_item'}>
                  <JSONTree
                      displayObjectSize={false}
                      enableClipboard={false}
                      key={index}
                      displayDataTypes={false}
                      collapsed
                      name={'global-state'}
                      src={item}
                  />
                </div>
              })
            }
          </div>
        }
        {
          subs && <div className={'zIndex'} style={{
            width: key == 'subs' ? null : 0,
            height: key == 'subs' ? null : 0,
            padding: key == 'subs' ? null : 0,
            overflow: key == 'subs' ? 'auto' : 'hidden',
          }}>
            {
              subs.map((item, index) => {
                return <div key={index} className={'action_item'}>
                  <JSONTree
                      displayObjectSize={false}
                      enableClipboard={false}
                      key={index}
                      displayDataTypes={false}
                      collapsed
                      name={'subs-state'}
                      src={item}
                  />
                </div>
              })
            }
          </div>
        }
        {
          actions &&
          <div className={'zIndex'} style={{
            width: key == 'actions' ? null : 0,
            height: key == 'actions' ? null : 0,
            padding: key == 'actions' ? null : 0,
            overflow: key == 'actions' ? 'auto' : 'hidden',
          }}>
            {
              actions.map((item, index) => {
                return <div key={index} className={'action_item'}>
                  {
                    typeof item == 'string'
                        ? item
                        : Object.keys(item).map((name, ele) => (
                            <React.Fragment key={index + '' + ele}>
                              <span> {name}> </span>
                              {
                                Object.keys(item[name]).map(action => (
                                    <React.Fragment key={index + '' + ele + action}>
                                      <span>{action}: </span>
                                      <JSONTree
                                          displayObjectSize={false}
                                          enableClipboard={false}
                                          key={index + '' + ele + action}
                                          displayDataTypes={false}
                                          collapsed
                                          name={false}
                                          src={item[name][action]}
                                      />
                                    </React.Fragment>

                                ))
                              }
                            </React.Fragment>
                        ))
                  }
                </div>
              })
            }
          </div>
        }
      </div>
    </Box>
  }
}

export default function _setDevTool(bool) {
  if (!bool) return
  const div = document.createElement('div')
  div.id = 'dive-devtool'
  document.body.appendChild(div)
  ReactDOM.render(
      <DevTool/>,
      div,
  )
}

