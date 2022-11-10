import React, { useEffect, useState } from 'react';
import { Stack } from '@mui/system';
import classNames from 'classnames';
import { getWeather } from "../../service";
import { Chip } from '@mui/material';


export default function Weather(){
    const [weatherList,setWeatherList] = useState([{}]);
    useEffect(() => {
        getWeather({
            page: 1,
            pageSize: 7,
            city:window.returnCitySN.cname
        }).then(res => {
            console.log(res);
            setWeatherList(res.data.list)
        })
    }, [setWeatherList])

    return ( <Stack direction="row" spacing={1} className="select-none" alignItems="center" mr="20px">

        <span>{window.returnCitySN.cname}</span>
        <span>{weatherList[0].weather}</span>
        <span>{weatherList[0].temp}°C</span>
        <Chip label={weatherList[0].airQuality} variant="filled" size="small" color={["优","良"].includes(weatherList[0].airQuality)?'success':'warning'}>

        </Chip>
    </Stack>)
}