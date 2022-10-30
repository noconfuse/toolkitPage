import React, { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Button, InputBase, List, ListItemButton, ListItemText, Menu, MenuItem, Paper, Select } from '@mui/material';
import { Search, ArrowDropDown, ArrowDropUp } from '@mui/icons-material';
import { throttle } from '../../utils';
import { fetchSuggestions } from '../../service';


export default function SearchInput() {

    const [searchOptions] = useState([{
        key: 1,
        name: "百度",
        searchUrl:"https://www.baidu.com/s?wd=${searchKey}"
    },{
        key: 2,
        name: "谷歌",
        searchUrl:"https://www.google.com/search?q=${searchKey}"
    },{
        key: 3,
        name: "必应",
        searchUrl:"https://www.bing.com/search?q=${searchKey}"
    },{
        key: 4,
        name: "哔哩哔哩",
        searchUrl:"https://search.bilibili.com/all?keyword=${searchKey}"
    }]);

    const [searchStr,setSearchStr] = useState('')
    const [searchTypeKey, setSearchTypeKey] = useState(1);
    const [suggestionShow,setSuggestionShow] = useState(false);
    const [suggestionList,setSuggestionList] = useState([]);
    let [hoverSuggesionIndex,setHoverSuggestionIndex] = useState(-1);
    const [anchorEl, setAnchorEl] = useState(null);

    const open = Boolean(anchorEl);
    const handleClickChooseBtn = useCallback((event) => {
        const current = event.currentTarget;
        setAnchorEl(current)
    }, [])

    const handleCloseMenu = useCallback(() => {
        setAnchorEl(null)
    }, [])

    console.log(1111)
    const handleMenuItemClick = (event, option) => {
        setSearchTypeKey(option.key);
        setAnchorEl(null);
    }

    const currentSearch = useMemo(() => {
        const currentOption = searchOptions.find(option => {
            return option.key === searchTypeKey
        })
        if (!currentOption) {
            return {}
        }
        return currentOption;
    }, [searchTypeKey])

    const search = (searchStr)=>{
        debugger
        if(currentSearch.searchUrl){
            const searchUrl = currentSearch.searchUrl.replace('${searchKey}',searchStr)
            window.open(searchUrl,'_blank')
        }
    }

    const handleKeyUp = useCallback((event)=>{
        const keyCode = event.keyCode;
        if(keyCode===13){
            search(searchStr)
        }else if(keyCode===40){
            if(hoverSuggesionIndex >= suggestionList.length-1){
                hoverSuggesionIndex = suggestionList.length-1;
            }else{
                hoverSuggesionIndex++;
            }
            setHoverSuggestionIndex(hoverSuggesionIndex)
            setSearchStr(suggestionList[hoverSuggesionIndex].q);
        }else if(keyCode===38){
            if(hoverSuggesionIndex<=0){
                hoverSuggesionIndex = 0;
            }else{
                hoverSuggesionIndex--;
            }
            setHoverSuggestionIndex(hoverSuggesionIndex)
            setSearchStr(suggestionList[hoverSuggesionIndex].q);
        }
    },[searchStr,hoverSuggesionIndex,suggestionList,search])

    const getSuggestion = throttle((searchStr)=>{
        if(!searchStr) return;
        fetchSuggestions(searchStr).then(res=>{
            const {g} = res;    
            setSuggestionList(g||[])
        })
    },500,true)


    const handleChooseSearchStr = (event,str)=>{
        setSearchStr(str);
        search(str)
    }

    const handleSearchInputBlur = useCallback(()=>{
        setSuggestionShow(false)
    },[setSuggestionShow])

    const handleSearchInputFocus = useCallback(()=>{
        setSuggestionShow(true)
    },[setSuggestionShow])


    useEffect(()=>{
        //从storage中获取搜索历史记录
    },[])


    return (
        <div className="fixed w-6/12 max-w-3xl -translate-x-1/2 bg-white rounded-lg searchContainer left-1/2 bg-opacity-80 top-1/4">
            <div className="flex justify-between pl-3">
                <InputBase startAdornment={ <Search></Search>} placeholder="搜一搜" className="flex-grow pt-4 pb-4 font-bold" onKeyUp={handleKeyUp} value={searchStr} onChange={(event)=>{
                    setSearchStr(event.target.value);
                    getSuggestion(event.target.value)
                }} onBlur={handleSearchInputBlur} onFocus={handleSearchInputFocus}></InputBase>
                <Button aria-haspopup="true" variant="text" endIcon={open ? <ArrowDropUp></ArrowDropUp> : <ArrowDropDown></ArrowDropDown>} onClick={handleClickChooseBtn}>{currentSearch.name}</Button>
                <Menu open={open} anchorEl={anchorEl} onClose={handleCloseMenu}>
                    {searchOptions.map((option) =>
                        <MenuItem onClick={(event) => {
                            handleMenuItemClick(event, option)
                        }} key={option.key}>
                            {option.name}
                        </MenuItem>
                    )}
                </Menu>
            </div>
            {suggestionShow&&suggestionList.length?<List className="p-1">
                {suggestionList.map((list,index)=>{
                    return <ListItemButton selected={hoverSuggesionIndex===index} key={list.q}>
                        <ListItemText primary={list.q} onClick={(event)=>{
                            handleChooseSearchStr(event,list.q)
                        }}/>
                        </ListItemButton>
                })}
            </List>:null}

        </div>
    )
}