import React from 'react';
import Paper from 'material-ui/Paper';
import DropDownMenu from 'material-ui/DropDownMenu';
import MenuItem from 'material-ui/MenuItem';
import FlatButton from 'material-ui/FlatButton';
import Draggable from 'react-draggable';
import FontIcon from 'material-ui/FontIcon'
import utils from '../utils'
import Calendardetail from './calendetail';
const days = ['一','二','三','四','五','六','日'];
const style = {
    dragArea:{
        cursor:"move",
        height:30,
        userSelect:"none"
    },
    selectYear:{
        width:100,
        lineHeight:'30px',
        height:30,
    },
    iconStyle:{
        height:30,
        padding:0,
        width:28,
        right:2
    },
    labelStyle:{
        lineHeight:'30px',
        height:30,
        paddingLeft:15,
        paddingRight:30,
        border:'1px solid #333',
    },
    selectMonth:{
        width:90,
        lineHeight:'30px',
        height:30
    },
    flatButton:{
        height:34
    },
    nagetiveDate:{
        color:"#b1a8a8"
    },
    positiveDate:{
        color:"#ddddd"
    },
}
const yearItems = [],
      monthItems = [];
for(let i=1900;i<=2060;i++){
    yearItems.push(<MenuItem value={i} primaryText={`${i}年`} key={i}/>)
}
for(let i=1;i<=12;i++){
    monthItems.push(<MenuItem value={i} primaryText={`${i}月`} key={i}/>)
}
/*
* 思路：
*   1、得到当前月份或选中时间月份，*/
export default class Calendar extends React.Component {
    constructor(props){
        super(props);
        let Year = new Date().getFullYear(),
            Month = new Date().getMonth(),
            date = new Date().getDate();
        this.state = {
            selectDate:Date,
            selectYear:Year,
            selectMonth:Month,
            data:utils.calendar.solar2lunar(Year,Month+1,date)
        };
        this.handleClick=this.handleClick.bind(this);
        this.handleYearChange=this.handleYearChange.bind(this);
        this.handleMonthChange=this.handleMonthChange.bind(this);
        this.lastMonth = this.lastMonth.bind(this);
        this.nextMonth = this.nextMonth.bind(this);
    }
    componentWillMount(){

    }
    componentDidMount(){

    }
    handleClick(e,data){
        console.log(data);
        this.setState({
            selectYear:data.cYear,
            selectMonth:data.cMonth-1,
            selectDate:data.cDay,
            data:data
        });
    }
    handleYearChange = (e,i,value)=>{
        this.setState({selectYear:value})
    }
    handleMonthChange = (e,i,value)=>{
        this.setState({selectMonth:value-1})
    }
    handleDateChange = (e,i,value)=>{
        this.setState({selectDate:value})
    }
    lastMonth=(e)=>{
        if(e.preventDefault){
            e.preventDefault()
        }
        if(this.state.selectMonth===0){
            this.setState({selectYear:this.state.selectYear-1,selectMonth:11})
        }else{
            this.setState({selectMonth:this.state.selectMonth-1})
        }
    }
    nextMonth=(e)=>{
        if(e.preventDefault){
            e.preventDefault()
        }
        if(this.state.selectMonth===11){
            this.setState({selectYear:this.state.selectYear+1,selectMonth:1})
        }else{
            this.setState({selectMonth:this.state.selectMonth+1})
        }
    }
    render() {
        let calTrs = [],
            calTds = [];
        let currentTime = new Date(),
            today = new Date(currentTime.getFullYear(),currentTime.getMonth(),currentTime.getDate());
        let baseMonth = this.state.selectMonth,
            bd = this.state.selectDate,
            baseYear = this.state.selectYear;
        let positiveDate = false;
        for(let i=-5;i<=37;i++){
            let date = new Date(baseYear,baseMonth,i),
                year = date.getFullYear(),
                month = date.getMonth()+1,
                day = date.getDate(),
                dom;
            let data = utils.calendar.solar2lunar(year,month,day);
            if(day===1){
                positiveDate = !positiveDate;
            }
            if(data.nWeek===1){
                calTds  = [];
            }
            dom = <td key={i} onClick={e=>this.handleClick(e,data)}>
                <a href="javascript:void(0)" date-index={date} style={!positiveDate?style.nagetiveDate:style.positiveDate}>
                    <span className={"solar "+(bd===i?"selected":"")+" "+(data.isToday?"current":"")}>{date.getDate()}</span>
                    <span className="lunar">{data.IDayCn}</span>
                </a>
            </td>;
            calTds.push(dom);
            if(data.nWeek===7&&calTds.length===7){
                calTrs.push(calTds)
            }
        }
        return (
            <Draggable handle=".dragArea" bounds="parent">
                <div className='calendar'>
                    <div>
                        <h4 className="dragArea flex-between">
                            <FontIcon className="material-icons" onClick={this.lastMonth}>chevron_left</FontIcon>日历<FontIcon className="material-icons" onClick={this.nextMonth}>chevron_right</FontIcon></h4>
                        <div className="flex-between">
                            <DropDownMenu
                                maxHeight={300}
                                value={this.state.selectYear}
                                onChange={this.handleYearChange}
                                style={style.selectYear}
                                labelStyle={style.labelStyle}
                                iconStyle={style.iconStyle}
                            >
                                {yearItems}
                            </DropDownMenu>
                            <DropDownMenu
                                maxHeight={300}
                                value={this.state.selectMonth+1}
                                onChange={this.handleMonthChange}
                                style={style.selectMonth}
                                labelStyle={style.labelStyle}
                                iconStyle={style.iconStyle}
                            >
                                {monthItems}
                            </DropDownMenu>
                            <FlatButton
                                primary={true}
                                label="返回今天"
                                style={style.flatButton}
                            />
                        </div>
                        <div className="line-blue margin-10"></div>
                        <table cellSpacing='0'>
                            <tbody>
                            <tr>
                                {days.map((day, index) => <td key={index}>{day}</td>)}
                            </tr>
                            {calTrs.map((trDom, idx) => <tr key={idx}>
                                {trDom}
                            </tr>)}
                            </tbody>
                        </table>
                    </div>
                    <Calendardetail data = {this.state.data}/>
                </div>
            </Draggable>
        );
    }

}
