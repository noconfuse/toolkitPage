import React, {Component} from 'react';
import Header from '../Header';
import './index.scss';

export default class Layout extends Component {
    render() {
        return (
            <div className="appContent">
                <Header></Header>
                <div className="mx-auto main xl:max-w-7xl sm:max-w-sm md:max-w-md">
                    {this.props.children}
                </div>
            </div>
        )
    }
}