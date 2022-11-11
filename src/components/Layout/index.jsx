import { Box } from '@mui/system';
import React, {  useCallback, useState } from 'react';
import HotRank from '../HotRank';
import StarField from '../StarField';
import Header from './Header';
import './index.scss';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import SideBar from './SideBar';
import { IconButton, Tooltip } from '@mui/material';
import classNames from 'classnames';
import { deepOrange } from '@mui/material/colors';

export default function Layout(props) {
    const { routesConfig } = props;
    const [open, setOpen] = useState(false);
    const switchOpen = useCallback(() => {
        setOpen(!open)
    }, [setOpen, open])
    const [hotRankShow, setHotRankShow] = useState(false);
    const showHotRank = useCallback(() => {
        setHotRankShow(!hotRankShow)
    }, [hotRankShow, setHotRankShow])
    return (
        <div className="relative appContent">
            {/* <SideBar routes={routesConfig} menuOpen={open} /> */}
            {/* <div className="relative z-10 flex-1 overflow-x-hidden"> */}
            <Header switch={switchOpen} menuOpen={open}></Header>
            <Box sx={{ position: "absolute", width: "100%", minHeight: "100vh" }}>
                <StarField />
            </Box>
            <div className="pt-24 mx-auto main max-w-7xl">
                {props.children}
            </div>
            <Box className={classNames("fixed", "top-1/2", "left-0", "transition-transform", hotRankShow ? "" : "-translate-x-full","-translate-y-1/2", "w-96","h-4/5")}>
                <HotRank></HotRank>
                <Tooltip title="热点">
                    <IconButton className="absolute -translate-y-1/2 left-full top-1/2" sx={{ position: "absolute" ,bgcolor:deepOrange[500]}} onClick={showHotRank}>
                        {hotRankShow?<KeyboardDoubleArrowLeftIcon></KeyboardDoubleArrowLeftIcon>:<KeyboardDoubleArrowRightIcon></KeyboardDoubleArrowRightIcon>}
                    </IconButton>
                </Tooltip>
            </Box>
            {/* </div> */}
        </div>
    )
}