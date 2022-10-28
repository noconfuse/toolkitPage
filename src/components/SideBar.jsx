import React from 'react';
import {Link} from 'react-router';
import {List,ListItem} from 'material-ui/List';
import ContentInbox from 'material-ui/svg-icons/content/inbox';
const SidebarLinks = [
    {
        name:'任务',
        path:'task',
    },
    {
        name:'便签',
        path:'notes',
    },
    {
        name:'分类',
        path:'category',
    },
    {
        name:'地点',
        path:'address',
    },
    {
        name:'标签',
        path:'tags',
    }
];

export default class SideBar extends React.Component{
    constructor(props){
        super(props);
        this.state = {open:true};
    }
    render(){
        return (
            <List className='side_bar'>
                {SidebarLinks.map(link => <ListItem
                    key={link.name}
                   
                    primaryText={link.name}
                    />)}
            </List>
        )
    }
}
