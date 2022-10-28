import React from  "react";

const style = {
    date:{
        transform:"rotate(90deg)",
        display:'inline-block',
        transformOrigin:"12% 50%",
        marginTop:"9px"
    },
    week:{
        marginTop:"65px",
        display:"inline-block"
    },
    day:{
        fontSize: '100px',
        textShadow:'5px 2px 6px rgb(151, 82, 82)',
        color:"rgb(223, 143, 143)",
        marginBottom:'15px'
    }
}
export default class Calendardetail extends React.Component{
    constructor(props){
        super(props);
        this.state = {dayDetails:props.data};
    }
    render(){
        console.log(this.props.data);
        let dayDetail = this.props.data;
        return (
            <div className="calendarDetail">
                <p></p>
                <div className="flex-between">
                    <div className="lunarDetail">
                        <span>{dayDetail.gzYear}年</span>
                        <span>{dayDetail.Animal}年 </span>
                        <span>{dayDetail.gzMonth}月</span>
                        <span>{dayDetail.gzDay}日</span>
                    </div>
                    <div className="solarDetail"><span style={style.date}>{dayDetail.cYear}.{dayDetail.cMonth}.{dayDetail.cDay}</span><span style={style.week}>{dayDetail.ncWeek}</span></div>
                    <div className="solarDay">
                        <div style={style.day}>{dayDetail.cDay}</div>
                        <div className="toDo">宜睡觉</div>
                    </div>
                </div>
                <div className="notes">
                    <blockquote cite="诗经《小雅》">
                        如月之恒，如日之升。如南山之寿，不骞不崩。如松柏之茂，无不尔或承。<br/>
                        <p className="align-right">——诗经 《小雅》</p>
                    </blockquote>
                </div>
            </div>
        )
    }
}