import { Box } from '@mui/system';
import React from 'react';
import Calendar from '../../components/Calendar'
import SearchInput from '../../components/SearchInput';
import ToolBar from '../../components/ToolBar'
import Translate from '../../components/Translate';
import './index.scss';


export default class Landing extends React.Component{
    render(){
        return (
            <div className="landing">
                
                {/* <RaisedButton label="登录" style={style.signinBtn} primary={true} href="user/login" /> */}
                {/* <RaisedButton label="注册" style={style.registerBtn} href="user/register"/> */}
                {/* <Calendar/> */}
                {/* <ToolBar></ToolBar> */}
                <div className="fixed right-6 top-6">
                    <Translate></Translate>

                </div>
                <SearchInput></SearchInput>
            </div>
        );
    }
}