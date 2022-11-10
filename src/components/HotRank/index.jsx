import React, { useEffect, useState } from "react";
import Grid2 from "@mui/material/Unstable_Grid2/Grid2";
import classNames from "classnames";
import { getHotRank } from "../../service";
import { formateHotTime, formateTrendNum } from "../../utils";
import { Box } from "@mui/system";

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
    <Grid2 container rowSpacing={2} columnSpacing={{ xs: 1, sm: 2, md: 3 }}>
      {hotRankConfig.map((rank) => (
        <Grid2 xs={4} key={rank.rankName}>
          <div className="w-full p-2 bg-white rounded">
            <div className="flex items-center justify-between pb-2 border-b border-solid cardTitle border-slate-300">
                <img src={hotRanks[rank.dataKey]?.logo} alt="" className="w-6 h-6 mr-2" />
                <span className="flex-1">
                {rank.rankName}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                    更新于{formateHotTime(hotRanks[rank.dataKey]?.updateTime)}
                </span>
                </div>
            <ul className="pt-2 overflow-y-auto max-h-96">
              {hotRanks[rank.dataKey]?.items.map((item,index) => {
                return (
                  <li key={item.itemTitle} className="pb-1 text-black">
                    <a href={item.itemLink} target="_blank" className="flex justify-between text-black visited:text-gray-300 hover:text-blue-500">
                    <span className={classNames(index<=2?'text-red-400':'',"w-6","inline-block")}>{index+1}.</span>
                      <span className="flex-1">{item.itemTitle}</span>
                      <span className="items-end content-end text-gray-500">{formateTrendNum(item.trendNum)}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </Grid2>
      ))}
    </Grid2>
  );
}
