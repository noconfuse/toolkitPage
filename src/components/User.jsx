import React from 'react';
import Paper from '@mui/material/Paper';
import {Toolbar} from '@mui/material/Toolbar';
import { indigo } from '@mui/material/colors';

const style = {
    toolbar:{
      background:'#fff'
    },
    main:{
        background:indigo[50],
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
                <Paper className="flex warpper" style={style.box}>
                    <img src="/assets/images/small_bg.jpg" alt=""/>
                    {this.props.children}
                </Paper>
            </div>
        )
    }
}