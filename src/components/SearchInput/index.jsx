import React, {  useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Chip, InputBase, List, ListItemButton, ListItemText, Menu, MenuItem, Paper, Select } from '@mui/material';
import { Search } from '@mui/icons-material';
import { throttle } from '../../utils';
import { fetchSuggestions } from '../../service';
import { useNavigate } from 'react-router-dom';


export default function SearchInput() {

    const [searchOptions] = useState([{
        key: 1,
        name: "百度",
        searchUrl: "https://www.baidu.com/s?wd=${searchKey}"
    }, {
        key: 2,
        name: "谷歌",
        searchUrl: "https://www.google.com/search?q=${searchKey}"
    }, {
        key: 3,
        name: "必应",
        searchUrl: "https://www.bing.com/search?q=${searchKey}"
    }, {
        key: 4,
        name: "哔哩哔哩",
        searchUrl: "https://search.bilibili.com/all?keyword=${searchKey}"
    },{
        key:5,
        name:"搜狗",
        searchUrl:"https://www.sogou.com/web?query=${searchKey}"
    },{
        key:6,
        name:"GitHub",
        searchUrl:"https://github.com/search?q=${searchKey}"
    }]);

    const [searchStr, setSearchStr] = useState('')
    const [searchTypeKey, setSearchTypeKey] = useState(1);
    const [suggestionShow, setSuggestionShow] = useState(false);
    const [suggestionList, setSuggestionList] = useState([]);
    const navigateTo = useNavigate()
    let [hoverSuggesionIndex, setHoverSuggestionIndex] = useState(-1);


    const handleChipItemClick = (option,event) => {
        setSearchTypeKey(option.key);
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

    const search = (searchStr) => {
        if (currentSearch.searchUrl) {
            const searchUrl = currentSearch.searchUrl.replace('${searchKey}', searchStr)
            window.open(searchUrl, '_blank')
        }else{
            navigateTo('/scrapy')
        }
    }

    const handleKeyUp = useCallback((event) => {
        const keyCode = event.keyCode;
        if (keyCode === 13) {
            search(searchStr)
        } else if (keyCode === 40) {
            if (hoverSuggesionIndex >= suggestionList.length - 1) {
                hoverSuggesionIndex = suggestionList.length - 1;
            } else {
                hoverSuggesionIndex++;
            }
            setHoverSuggestionIndex(hoverSuggesionIndex)
            setSearchStr(suggestionList[hoverSuggesionIndex].q);
        } else if (keyCode === 38) {
            if (hoverSuggesionIndex <= 0) {
                hoverSuggesionIndex = 0;
            } else {
                hoverSuggesionIndex--;
            }
            setHoverSuggestionIndex(hoverSuggesionIndex)
            setSearchStr(suggestionList[hoverSuggesionIndex].q);
        }
    }, [searchStr, hoverSuggesionIndex, suggestionList, search])

    const getSuggestion = throttle((searchStr) => {
        if (!searchStr) return;
        fetchSuggestions(searchStr).then(res => {
            const { g } = res;
            setSuggestionList(g || [])
        })
    }, 500, true)


    const handleChooseSearchStr = (event, str) => {
        setSearchStr(str);
        search(str)
    }

    const handleSearchInputBlur = useCallback(() => {
        setSuggestionShow(false)
    }, [setSuggestionShow])

    const handleSearchInputFocus = useCallback(() => {
        setSuggestionShow(true)
    }, [setSuggestionShow])


    useEffect(() => {
        //从storage中获取搜索历史记录
    }, [])



    return (
        <div className="relative w-2/6 max-w-3xl mx-auto searchContainer">
            <div className="flex justify-between pl-3 bg-white rounded-full">
                <InputBase startAdornment={<Search></Search>} name="searchInput" placeholder="搜一搜" className="flex-grow py-2 font-bold" onKeyUp={handleKeyUp} value={searchStr} onChange={(event) => {
                    setSearchStr(event.target.value);
                    getSuggestion(event.target.value)
                }} onBlur={handleSearchInputBlur} onFocus={handleSearchInputFocus}></InputBase>
                {/* <Button aria-haspopup="true" variant="text" endIcon={open ? <ArrowDropUp></ArrowDropUp> : <ArrowDropDown></ArrowDropDown>} onClick={handleClickChooseBtn}>{currentSearch.name}</Button> */}
                {/* <Menu open={open} anchorEl={anchorEl} onClose={handleCloseMenu}>
                    {searchOptions.map((option) =>
                        <MenuItem onClick={(event) => {
                            handleChipItemClick(event, option)
                        }} key={option.key}>
                            {option.name}
                        </MenuItem>
                    )}
                </Menu> */}
            </div>

            <ul className="flex justify-start gap-3 mt-3">
                {
                    searchOptions.map(item => {
                        return (<li key={item.name}>
                            <Chip label={item.name} variant={searchTypeKey===item.key?"filled":"outlined"} clickable color="info" onClick={handleChipItemClick.bind(this,item)}>

                            </Chip>

                        </li>)
                    })
                }
            </ul>
           
            <label htmlFor="searchInput" onMouseDown={(e) => { e.preventDefault() }} className="absolute w-full">
                {suggestionShow && suggestionList.length ? <List className="p-1 bg-white" onClick={(e) => { e.preventDefault() }}>
                    {suggestionList.map((list, index) => {
                        return <ListItemButton selected={hoverSuggesionIndex === index} key={list.q}>
                            <ListItemText primary={list.q} onClick={(event) => {
                                handleChooseSearchStr(event, list.q)
                            }} />
                        </ListItemButton>
                    })}
                </List> : null}

            </label>

        </div>
    )
}