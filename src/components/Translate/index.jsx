import { Button, TextareaAutosize, Divider, Fab, Popover, TextField, Grid, ToggleButtonGroup, ToggleButton, Tooltip, ListItem, MenuItem, Select, Autocomplete } from '@mui/material';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import { Box } from '@mui/system';
import React, { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import ForwardIcon from '@mui/icons-material/Forward';
import { translateText, distinguish } from '../../service';
import './index.scss'
import { debounce } from '../../utils';
import lanCode from '../../utils/lanCode.json';
console.log(lanCode)

const lanOptions = [];

for (let key in lanCode) {
    if (lanCode[key]) {
        lanOptions.push({
            code: key,
            label: lanCode[key]
        })
    }
}



const domains = [
    {
        name: "",
        cname: "通用领域",
    },
    {
        name: "electronics",
        cname: "电子科技",
        direction: { 'zh': "en" } // 中文--> 英文
    },
    {
        name: "finance",
        cname: "金融财经",
        direction: { 'zh': 'en', 'en': 'zh' } // 中文--> 英文,英文 --> 中文
    },
    {
        name: "mechanics",
        cname: "水利机械",
        direction: { 'en': 'zh' }// 英文 --> 中文
    },
    {
        name: "medicine",
        cname: "生物医药",
        direction: { 'zh': 'en', 'en': 'zh' } // 中文--> 英文,英文 --> 中文
    },
    {
        name: "novel",
        cname: "网络文学",
        direction: { 'en': 'zh' }  // 英文 --> 中文
    }
]




export default function Translate() {
    const textAreaRef = useRef();
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const [domain, setDomain] = useState('');
    const [toLanText, setToLanText] = useState({ label: "英语", code: "en" });
    const [fromLanText, setFromLanText] = useState({ label: "中文(简体)", code: "zh" });
    const [translateResult, setTranslateResult] = useState([])
    const [distinguishCount,setDistinguishCount] = useState(0)

    const handleClose = useCallback(() => {
        setAnchorEl(null);
    }, [setAnchorEl])

    const handleToLanAutoCompleteChange = useCallback((event, detail) => {
        setToLanText(detail)
    }, [setToLanText])


    const handleFromLanAutoCompleteChange = useCallback((event, detail) => {
        setFromLanText(detail)
    }, [setFromLanText])

    const showTranslateModal = useCallback((event) => {
        setAnchorEl(event.currentTarget);
    }, [])

    const handleDomainSelectChange = useCallback((event) => {
        setDomain(event.target.value)
    })

    const handleTextChange = debounce((event) => {
        const value = event.target.value;
        if (!value) {
            return;
        }
        distinguish(value).then(res => {
            const { data } = res;
            if (!data) return;
            const fromLan = lanOptions.find(lan => {
                return lan.code === data.src;
            })
            setDistinguishCount(distinguishCount+1)
            setFromLanText(fromLan);
        })
    }, 500)


    useEffect(() => {
        if (textAreaRef.current && textAreaRef.current.value) {
            translateText(textAreaRef.current.value, {
                from: fromLanText.code,
                to: toLanText.code,
                domain: domain
            }).then(res => {
                const { trans_result = [] } = res;
                setTranslateResult(trans_result)
            })
        }
    }, [fromLanText, toLanText,distinguishCount])


    return (
        <Fragment>
            <Fab color="secondary" aria-label="translate" size="medium" onClick={showTranslateModal}>
                译
            </Fab>
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'center',
                    horizontal: 'left',
                }}
                transformOrigin={
                    {
                        vertical: 'top',
                        horizontal: 'right',
                    }
                }
            >
                <div className="px-3 pb-3">
                    <div className="flex justify-end h-10 my-2">
                        <div className="inline-block bg-white select-none" >
                            <Select className="selectNoBorder" value={domain} displayEmpty inputProps={{ 'aria-label': 'Without label' }} size="small" onChange={handleDomainSelectChange}>
                                {
                                    domains.map(domain => {
                                        if (!domain.direction) {
                                            return <MenuItem key={domain.name} value={domain.name} >{domain.cname}</MenuItem>
                                        }
                                        let disabled = domain.direction[fromLanText.code] !== toLanText.code;
                                        return (<MenuItem key={domain.name} value={domain.name} disabled={disabled}>{domain.cname}</MenuItem>)
                                    })
                                }
                            </Select>
                        </div>
                    </div>
                    <div className="h-10 my-2">
                        <div className="flex">
                            <Autocomplete sx={{ width: 210 }} disableClearable value={fromLanText} clearOnBlur options={lanOptions} renderInput={params => {
                                return (<TextField {...params} variant="standard" />)
                            }} onChange={handleFromLanAutoCompleteChange}>
                            </Autocomplete>
                            <ArrowRightAltIcon className="mx-3"></ArrowRightAltIcon>
                            <Autocomplete sx={{ width: 215 }} disableClearable value={toLanText} clearOnBlur onChange={handleToLanAutoCompleteChange} options={lanOptions} renderInput={params => {
                                return (<TextField {...params} variant="standard" />)
                            }}>
                            </Autocomplete>
                        </div>

                    </div>
                    <div className="flex">
                        <TextareaAutosize
                            placeholder="输入文字，自动识别语种"
                            ref={textAreaRef}
                            minRows={4}
                            variant="filled"
                            className="h-full p-1 border border-solid fill-inherit w-60"
                            onChange={handleTextChange}
                        />
                        <div className="p-1 bg-gray-300 w-60">
                            {translateResult.map(item => (<p className="">
                                {item.dst}
                            </p>))}

                        </div>
                    </div>
                </div>
            </Popover>
        </Fragment>

    )
}