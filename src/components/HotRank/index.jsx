import React, { useEffect, useState } from "react";
import Grid2 from "@mui/material/Unstable_Grid2/Grid2";
import classNames from "classnames";
import { getHotRank } from "../../service";
import { formateHotTime, formateTrendNum } from "../../utils";
import { Box, Stack } from "@mui/system";
import { Circle } from "@mui/icons-material";
import { Chip, CircularProgress } from "@mui/material";

const hotRankConfig = [
  {
    type: 1,
    rankName: "百度热搜",
    dataKey: "baiduHotRank",
  },
  {
    type: 2,
    rankName: "微博热搜",
    dataKey: "weiboHotRank",
  },
  {
    type: 3,
    rankName: "知乎热搜",
    dataKey: "zhihuHotRank",
  },
  {
    type: 4,
    rankName: "头条热搜",
    dataKey: "toutiaoHotRank",
  },
  {
    type: 5,
    rankName: "b站热搜",
    dataKey: "bilibiliHotRank",
  },
  {
    type: 6,
    rankName: "IT资讯",
    dataKey: "ITHotRank",
  }
];

export default function HotRank() {
  const queryTypes = hotRankConfig.map((c) => c.type);
  const [hotRanks, setHotRanks] = useState({});
  useEffect(() => {
    getHotRank(queryTypes.toString()).then((res) => {
      setHotRanks(res.data);
    });
  }, []);
  return (
    <Stack direction="column" className="max-h-full overflow-y-auto" >
      {hotRankConfig.map((rank) => (
        <Box xs={12} key={rank.rankName} sx={{ color: "text.primary" }}>
          <div className="w-full p-2 rounded">
            <div className="flex items-center justify-between cardTitle ">
              {/* <img src={hotRanks[rank.dataKey]?.logo} alt="" className="w-4 h-4 mr-2 " /> */}
              <span className="flex-1">
                {rank.rankName}
              </span>
              <span className="ml-2 text-xs text-gray-500">
                更新于{formateHotTime(hotRanks[rank.dataKey]?.updateTime)}
              </span>
            </div>
            {
              hotRanks[rank.dataKey] ? <ul className="pt-2 overflow-y-auto h-96">
                {hotRanks[rank.dataKey].items.map((item, index) => {
                  return (
                    <li key={item.itemTitle} className="pb-1">
                      <a href={item.itemLink} target="_blank" className="flex justify-between text-white visited:text-gray-300 hover:text-blue-500">
                        <span className={classNames(index <= 2 ? 'text-red-400' : '', "w-6", "inline-block")}>{index + 1}.</span>
                        <span className={classNames("flex-1")}>{item.itemTitle}
                          {item.itemLabel ? 
                          
                          <Chip className="ml-3" label={item.itemLabel} variant="filled" size="small" color={["沸","热"].includes(item.itemLabel)
                          ?'error'
                          :['新'].includes(item.itemLabel)
                          ?'warning':"secondary"}>

                          </Chip> : null}
                        </span>

                        <span className="items-end content-end text-gray-500">{formateTrendNum(item.trendNum)}</span>
                      </a>
                    </li>
                  );
                })}
              </ul> : <div className="flex items-center justify-center h-96"><CircularProgress color="secondary"></CircularProgress></div>
            }
          </div>

        </Box>
      ))}
    </Stack>
  );
}
