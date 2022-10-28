import React from 'react'
import RaisedButton from 'material-ui/RaisedButton';
import Calendar from './calendar'

const style = {
    registerBtn:{
        position: "absolute",
        top: "10px",
        right:"20px"
    },
    signinBtn:{
        position: "absolute",
        top: "10px",
        right:"130px"
    }
}
export default class Landing extends React.Component{
    render(){
        return (
            <div className='landing hv_center'>
                <RaisedButton label="登录" style={style.signinBtn} primary={true} href="user/login" />
                <RaisedButton label="注册" style={style.registerBtn} href="user/register"/>
                <Calendar/>
            </div>
        );
    }
}