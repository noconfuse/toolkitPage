import React from 'react';
import Calendar from '../../components/Calendar'
import bg from '../../assets/images/bg.jpg';
import './index.scss';


export default class Landing extends React.Component{
    render(){
        return (
            <div className="landing">
                
                {/* <RaisedButton label="登录" style={style.signinBtn} primary={true} href="user/login" /> */}
                {/* <RaisedButton label="注册" style={style.registerBtn} href="user/register"/> */}
                <Calendar/>
            </div>
        );
    }
}