import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Chip,
    InputBase,
    List,
    ListItemButton,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Select,
    Tab,
    Tabs,
} from "@mui/material";
import { Search } from "@mui/icons-material";
import { throttle } from "../../utils";
import { fetchSuggestions } from "../../service";
import { useNavigate } from "react-router-dom";

export default function SearchInput() {
    const [searchOptions] = useState([
        {
            name: "搜索",
            type: 1,
            options: [
                {
                    name: "百度",
                    searchUrl: "https://www.baidu.com/s?wd=${searchKey}",
                },
                {
                    name: "谷歌",
                    searchUrl: "https://www.google.com/search?q=${searchKey}",
                },
                {
                    name: "必应",
                    searchUrl: "https://www.bing.com/search?q=${searchKey}",
                },
                {
                    name: "搜狗",
                    searchUrl: "https://www.sogou.com/web?query=${searchKey}",
                },
                {
                    name: "头条",
                    searchUrl: "https://www.sogou.com/web?query=${searchKey}",
                },
                {
                    name: "GitHub",
                    searchUrl: "https://github.com/search?q=${searchKey}",
                },
            ],
        },
        {
            name: "文章",
            type: 2,
            options: [
                {
                    name: "简书",
                    searchUrl:
                        "https://www.jianshu.com/search?q=${searchKey}&page=1&type=note",
                },
                {
                    name: "知乎",
                    searchUrl: "https://www.zhihu.com/search?q=${searchKey}&type=content",
                },
            ],
        },
        {
            name: "翻译",
            type: 3,
            options: [
                {
                    name: "谷歌",
                    searchUrl:
                        "https://translate.google.com/?sl=auto&tl=en&text=${searchKey}&op=translate",
                },
                {
                    name: "百度",
                    searchUrl:
                        "https://fanyi.baidu.com/?aldtype=16047#auto/en/${searchKey}",
                },
            ],
        },
        {
            name: "图片设计",
            type: 4,
            options: [
                {
                    name: "UI中国",
                    searchUrl:
                        "https://s.ui.cn/index.html?keywords=${searchKey}&type=all",
                },
                {
                    name: "菜鸟图库",
                    searchUrl:
                        "https://www.sucai999.com/default/search/lists?keyword=${searchKey}",
                },
                {
                    name: "uplabs",
                    searchUrl: "https://www.uplabs.com/search?q=${searchKey}",
                },
            ],
        },
        {
            name: "视频",
            type: 4,
            options: [
                {
                    name: "抖音",
                    searchUrl: "https://www.douyin.com/search/${searchKey}",
                },
                {
                    name: "哔哩哔哩",
                    searchUrl: "https://search.bilibili.com/all?keyword=${searchKey}",
                },
                {
                    name: "爱奇艺",
                    searchUrl: "https://so.iqiyi.com/so/q_${searchKey}",
                },
                {
                    name: "腾讯视频",
                    searchUrl: "https://v.qq.com/x/search/?q=${searchKey}",
                },
                {
                    name: "人人影视",
                    searchUrl: "https://yyets.com/?s=${searchKey}",
                },
            ],
        },
        {
            name: "其他",
            type: 5,
            options: [
                {
                    name: "国家统计局",
                    searchUrl: "https://data.stats.gov.cn/search.htm?s=${searchKey}",
                },
            ],
        },
    ]);

    const [searchStr, setSearchStr] = useState("");
    const [searchSubTypeName, setSearchSubTypeName] = useState("百度");
    const [searchTypeName, setSearchTypeName] = useState("搜索");
    const [suggestionShow, setSuggestionShow] = useState(false);
    const [suggestionList, setSuggestionList] = useState([]);
    const navigateTo = useNavigate();
    let [hoverSuggesionIndex, setHoverSuggestionIndex] = useState(-1);

    const subSearchOptions = useMemo(() => {
        const matchSubOptions = searchOptions.find(
            (item) => item.name === searchTypeName
        );
        if (matchSubOptions) {
            return matchSubOptions.options;
        }
        return [];
    }, [searchTypeName, searchOptions]);

    const currentSearch = useMemo(() => {
        const currentOption = subSearchOptions.find((option) => {
            return option.name === searchSubTypeName;
        });
        if (!currentOption) {
            return {};
        }
        return currentOption;
    }, [subSearchOptions, searchSubTypeName]);

    const search = (searchStr) => {
        if (currentSearch.searchUrl) {
            const searchUrl = currentSearch.searchUrl.replace(
                "${searchKey}",
                searchStr
            );
            window.open(searchUrl, "_blank");
        } else {
            navigateTo("/scrapy");
        }
    };

    const handleKeyUp = useCallback(
        (event) => {
            const keyCode = event.keyCode;
            if (keyCode === 13) {
                search(searchStr);
            } else if (keyCode === 40) {
                if (hoverSuggesionIndex >= suggestionList.length - 1) {
                    hoverSuggesionIndex = suggestionList.length - 1;
                } else {
                    hoverSuggesionIndex++;
                }
                setHoverSuggestionIndex(hoverSuggesionIndex);
                setSearchStr(suggestionList[hoverSuggesionIndex].q);
            } else if (keyCode === 38) {
                if (hoverSuggesionIndex <= 0) {
                    hoverSuggesionIndex = 0;
                } else {
                    hoverSuggesionIndex--;
                }
                setHoverSuggestionIndex(hoverSuggesionIndex);
                setSearchStr(suggestionList[hoverSuggesionIndex].q);
            }
        },
        [searchStr, hoverSuggesionIndex, suggestionList, search]
    );

    const getSuggestion = throttle(
        (searchStr) => {
            if (!searchStr) return;
            fetchSuggestions(searchStr).then((res) => {
                const { g } = res;
                setSuggestionList(g || []);
            });
        },
        500,
        true
    );

    const handleChipItemClick = (option, event) => {
        setSearchSubTypeName(option.name);
    };

    const handleChooseSearchStr = (event, str) => {
        setSearchStr(str);
        search(str);
    };

    const handleSearchInputBlur = useCallback(() => {
        setSuggestionShow(false);
    }, [setSuggestionShow]);

    const handleSearchInputFocus = useCallback(() => {
        setSuggestionShow(true);
    }, [setSuggestionShow]);

    const handleChangeSearchType = useCallback((event, detail) => {
        setSearchTypeName(detail);
    });

    useEffect(() => {
        //从storage中获取搜索历史记录
        if(subSearchOptions.length){
            setSearchSubTypeName(subSearchOptions[0].name)
        }
    }, [subSearchOptions]);

    return (
        <div className="relative flex flex-col items-center w-full max-w-3xl mx-auto sm:w-1/2">
            <Tabs
                value={searchTypeName}
                onChange={handleChangeSearchType}
                textColor="secondary"
                indicatorColor="secondary"
                variant="scrollable"
                allowScrollButtonsMobile
                className="w-full"
            >
                {searchOptions.map((item) => (
                    <Tab value={item.name} key={item.name} label={item.name} sx={{fontSize:"20px"}} />
                ))}
            </Tabs>
            <div className="flex w-full pl-3 mt-3 bg-white rounded-full bg-opacity-70">
                <InputBase
                    sx={{ color: "ButtonText" }}
                    startAdornment={<Search></Search>}
                    name="searchInput"
                    placeholder="搜一搜"
                    className="flex-grow py-3 font-bold"
                    onKeyUp={handleKeyUp}
                    value={searchStr}
                    onChange={(event) => {
                        setSearchStr(event.target.value);
                        getSuggestion(event.target.value);
                    }}
                    onBlur={handleSearchInputBlur}
                    onFocus={handleSearchInputFocus}
                ></InputBase>
            </div>

            <ul className="flex w-full gap-3 mt-3 overflow-x-auto sm:justify-center">
                {subSearchOptions.map((item) => {
                    return (
                        <li key={item.name}>
                            <Chip
                                label={item.name}
                                variant={
                                    searchSubTypeName === item.name ? "filled" : "outlined"
                                }
                                clickable
                                onClick={handleChipItemClick.bind(this, item)}
                            ></Chip>
                        </li>
                    );
                })}
            </ul>

            <label
                htmlFor="searchInput"
                onMouseDown={(e) => {
                    e.preventDefault();
                }}
                className="absolute w-full top-full"
            >
                {suggestionShow&&suggestionList.length ? (
                    <List
                        className="p-1 bg-white"
                        onClick={(e) => {
                            e.preventDefault();
                        }}
                    >
                        {suggestionList.map((list, index) => {
                            return (
                                <ListItemButton
                                    selected={hoverSuggesionIndex === index}
                                    key={list.q}
                                >
                                    <ListItemText
                                        primary={list.q}
                                        onClick={(event) => {
                                            handleChooseSearchStr(event, list.q);
                                        }}
                                    />
                                </ListItemButton>
                            );
                        })}
                    </List>
                ) : null}
            </label>
        </div>
    );
}
