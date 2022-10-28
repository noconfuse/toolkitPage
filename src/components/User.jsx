import React from 'react';
import Paper from 'material-ui/Paper';
import {Toolbar} from 'material-ui/Toolbar';

import {indigo50} from 'material-ui/styles/colors'
const style = {
    toolbar:{
      background:'#fff'
    },
    main:{
        background:indigo50,
        height:"100%"
    },
    box:{
        marginTop:50
    }
}
export default class User extends React.Component{
    render(){
        return (
            <div style={style.main}>
                <Toolbar style={style.toolbar}>
                    <div className="warpper">
                    </div>
                </Toolbar>
                <Paper className="warpper flex" style={style.box}>
                    <img src="/assets/images/small_bg.jpg" alt=""/>
                    {this.props.children}
                </Paper>
            </div>
        )
    }
}