import { Image } from '@mui/icons-material';
import {  Icon, Popover, Tooltip } from '@mui/material';
import React, { Fragment, useCallback, useRef, useState } from 'react';
import './index.scss';

const SidebarMenus = [
    {
        name: '搜索',
        key:"search",
        iconName:'search'
    },
    {
        name: '设置',
        key:'settings',
        iconName: 'settings',
    }
];


const renderMenus = (menu)=>{
    if(menu.key=='search'){
        return (<Tooltip placement="right" title={
            <Fragment>
                <div className="cursor-pointer select-none">
                <Image></Image>
                <p>百度</p>

                </div>
            </Fragment>
        }>
                 <li className="p-1 hover:bg-slate-300 bg-opacity-30 hover:first:block"
            key={menu.name}
        >
             <Icon className="material-icons" >{menu.iconName}</Icon>
        </li>
            </Tooltip>)
    }
}

const ToolBar = () => {
    const hoverElement = useRef();
    const [searchOpen,setSearchOpen] = useState(false);
    return (<ul className="fixed left-0 overflow-hidden text-center bg-white shadow-xl select-none rounded-xl top-12 bg-opacity-80">
        {SidebarMenus.map(link => renderMenus(link)
        )}
    </ul>)
}


export default ToolBar