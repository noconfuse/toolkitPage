import { Box } from '@mui/system';
import React from 'react';
import HotRank from '../../components/HotRank';
import SearchInput from '../../components/SearchInput';

import './index.scss';


export default class Landing extends React.Component{
    render(){
        return (
            <div className="landing">
                
                {/* <RaisedButton label="登录" style={style.signinBtn} primary={true} href="user/login" /> */}
                {/* <RaisedButton label="注册" style={style.registerBtn} href="user/register"/> */}
                {/* <Calendar/> */}
                {/* <ToolBar></ToolBar> */}
                <div className="relative flex items-center h-96">
                    <SearchInput/>
                </div>
                <div className="fixed left-6 top-6">
                    {/* <Translate></Translate> */}
                </div>
                <Box padding="20px">
                    <HotRank></HotRank>
                </Box>
                
                {/* <SearchInput></SearchInput> */}
            </div>
        );
    }
}

