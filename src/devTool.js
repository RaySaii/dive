import React from 'react'
import ReactDOM from 'react-dom'
import styled from 'styled-components'
import {map, switchMap} from 'rxjs/operators'
import {devGlobalState$, actions$} from './globalState'
import subState$, {change$} from './subState'
import JSONTree from 'react-json-view'
import {isEmpty, omit, omitBy} from 'lodash'
import {ResizableBox} from 'react-resizable'
import diff from 'shallow-diff'
import {EMPTY, of} from 'rxjs'

const Box = styled.div`
  background: #f3f5f7;
  height: 100%;
  position: fixed;
  top:0;
  left:0;
  z-index: 1000000;
  transition: all 0.1s linear;
    box-shadow: 1px 0 20px rgba(0, 0, 0, 0.1);
  transform:${props => props.show == 'true' ? 'translateX(0)' : 'translateX(-100%)'};
  .resize_area{
    width: 17px;
    height: 100%;
    opacity: 0;
    position: absolute;
    top:0;
    right:0;
    z-index: 100;
    cursor: col-resize;
  }
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
     padding: 20px;
     overflow: auto;
     height: calc(100% - 30px);
     background: #f3f5f7;
    }
    .action_item{
    overflow-x: scroll;
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
    width: 408,
  }
  startWidth = 408

  select = key => {
    this.setState({ key })
  }

  onMouseDown = (e) => {
    this.down = true
    this.startX = e.clientX
  }

  componentDidMount() {
    document.body.onmousemove = (e) => {
      if (this.down) {
        const moveX = e.clientX - this.startX
        if (this.startWidth + moveX >= 408) {
          this.setState({ width: this.startWidth + moveX })
        }
      }
    }
    document.body.onmouseup = () => {
      this.down = false
      this.startWidth = this.state.width
    }
  }

  render() {
    const { show, key, width } = this.state

    return <Box style={{ width }} show={show.toString()}>
      <div onMouseDown={this.onMouseDown}
           className={'resize_area'}/>
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
        <GlobalPanel active={key == 'global'}/>
        <SubsPanel active={key == 'subs'}/>
        <ActionsPanel active={key == 'actions'}/>
      </div>
    </Box>
  }
}

function setActive(active) {
  return {
    width: active ? null : 0,
    height: active ? null : 0,
    padding: active ? null : 0,
    overflow: active ? 'auto' : 'hidden',
  }
}

class GlobalPanel extends React.PureComponent {
  state = {
    data: [],
  }

  componentDidMount() {
    devGlobalState$.subscribe(global => {
      return this.setState(state => ({ data: state.data.concat(global) }))
    })
  }

  render() {
    const { active } = this.props
    const { data } = this.state
    return (
        <div className={'zIndex'} style={setActive(active)}>
          {
            data.map((item, index) => {
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
    )
  }
}

class SubsPanel extends React.PureComponent {
  state = {
    data: [],
  }

  componentDidMount() {
    subState$.subscribe(subs => this.setState(state => ({ data: state.data.concat(subs) })))
  }

  render() {
    const { active } = this.props
    const { data } = this.state
    return (
        <div className={'zIndex'} style={setActive(active)}>
          {
            data.map((item, index) => {
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
    )
  }
}

class ActionsPanel extends React.PureComponent {
  state = {
    data: [],
    ignore: false,
  }

  componentDidMount() {
    actions$.subscribe(action => this.setState(state => ({ data: state.data.concat(action) })))
  }

  render() {
    const { active } = this.props
    const { data, ignore } = this.state
    return (
        <div className={'zIndex'} style={setActive(active)}>
          <div>
            <input onChange={e => this.setState({ ignore: e.target.checked })} type={'checkbox'}
                   id={'ignore unchanged'}
                   name={'ignore unchanged'}/>
            <label for='ignore unchanged'> ignore unchanged</label>
          </div>
          {
            data.map((item, index) => {
              return typeof item == 'string'
                  ? (ignore ? null : <div key={index} className={'action_item'}>{item}</div>)
                  : <div key={index} className={'action_item'}>
                    {Object.keys(item).map((name, ele) => (
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
                    ))}
                  </div>
            })
          }
        </div>
    )
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

