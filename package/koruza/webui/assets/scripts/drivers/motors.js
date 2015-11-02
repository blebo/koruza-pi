import React from 'react';
import Avatar from 'material-ui/lib/avatar';
import {Card, CardHeader, CardTitle, CardText} from 'material-ui/lib/card';
import LinearProgress from 'material-ui/lib/linear-progress';
import Toggle from 'material-ui/lib/toggle';
import Snackbar from 'material-ui/lib/snackbar';
import Slider from 'material-ui/lib/slider';
import RaisedButton from 'material-ui/lib/raised-button';

import _ from 'underscore';

import 'flexboxgrid';

class MotorController extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            controlEnabled: false,
            steps: 1,
            nextX: this.props.readings.next_x,
            nextY: this.props.readings.next_y,
            nextF: this.props.readings.next_f
        }

        this._onControlEnabledToggled = this._onControlEnabledToggled.bind(this);
        this._onGreenLaserToggled = this._onGreenLaserToggled.bind(this);
        this._onKeydown = this._onKeydown.bind(this);
        this._requestMove = _.throttle(this._requestMove.bind(this), 100);
        this._onHomeXClicked = this._onHomeXClicked.bind(this);
        this._onHomeYClicked = this._onHomeYClicked.bind(this);
        this._onStopClicked = this._onStopClicked.bind(this);
    }

    _onControlEnabledToggled(event, toggled) {
        if (toggled) {
            this.refs.snackbarMotorControl.show();
        } else {
            this.refs.snackbarMotorControl.dismiss();
        }

        this.setState({controlEnabled: toggled});
    }

    _onGreenLaserToggled(event, toggled) {
        this.props.bus.command('motor_configure', {laser: toggled});
    }

    _onKeydown(event) {
        if (!this.state.controlEnabled)
            return;

        let steps = this.refs.steps.getValue();
        let keymap = {
            // A.
            65: (state) => { state.nextX = Math.max(0, state.nextX - steps); },
            // D.
            68: (state) => { state.nextX = Math.min(70000, state.nextX + steps); },
            // S.
            83: (state) => { state.nextY = Math.max(0, state.nextY - steps); },
            // W.
            87: (state) => { state.nextY = Math.min(70000, state.nextY + steps); },
            // V.
            86: (state) => { state.nextF = Math.max(0, state.nextF - steps); },
            // F.
            70: (state) => { state.nextF = Math.min(20000, state.nextF + steps); },
        }
        if (!keymap[event.keyCode])
            return;

        let state = _.clone(this.state);
        keymap[event.keyCode](state);

        this.setState(state);
        this._requestMove();
    }

    _requestMove() {
        this.props.bus.command('motor_move', {
            next_x: this.state.nextX,
            next_y: this.state.nextY,
            next_f: this.state.nextF,
        });
    }

    _onHomeXClicked() {
        this.props.bus.command('motor_configure', {'motor_command': 2});
        this.refs.snackbarHomeX.show();
    }

    _onHomeYClicked() {
        this.props.bus.command('motor_configure', {'motor_command': 3});
        this.refs.snackbarHomeY.show();
    }

    _onStopClicked() {
        this.props.bus.command('motor_configure', {'motor_command': 1});
        this.refs.snackbarStop.show();
    }

    componentDidMount() {
        window.addEventListener('keydown', this._onKeydown);
    }

    componentWillUnmount() {
        window.removeEventListener('keydown', this._onKeydown);
    }

    render() {
        let styles = {
            snackbar: {
                zIndex: 20,
            }
        }

        return (
            <div>
                <Snackbar
                    ref="snackbarMotorControl"
                    message="Keyboard motor control is enabled."
                    style={styles.snackbar}
                />

                <Snackbar
                    ref="snackbarHomeX"
                    message="Requested homing on X axis."
                    autoHideDuration={1000}
                    style={styles.snackbar}
                />

                <Snackbar
                    ref="snackbarHomeY"
                    message="Requested homing on Y axis."
                    autoHideDuration={1000}
                    style={styles.snackbar}
                />

                <Snackbar
                    ref="snackbarStop"
                    message="Requested to stop all motion."
                    autoHideDuration={1000}
                    style={styles.snackbar}
                />

                <div className="row">
                    <div className="col-md-6">
                        <Toggle
                            ref="controlEnabled"
                            label="Keyboard motor control enabled"
                            onToggle={this._onControlEnabledToggled}
                        />
                        <br/>

                        Number of steps:
                        <Slider
                            name="steps"
                            ref="steps"
                            min={1}
                            max={300}
                            step={1}
                            defaultValue={1}
                            disabled={!this.state.controlEnabled}
                        />
                    </div>

                    <div className="col-md-6">
                        <Toggle
                            label="Green laser enabled"
                            onToggle={this._onGreenLaserToggled}
                            defaultToggled={this.props.readings.laser == 1}
                        />
                        <br/>

                        <RaisedButton
                            label="Home X"
                            onTouchTap={this._onHomeXClicked}
                        />
                        &nbsp;
                        <RaisedButton
                            label="Home Y"
                            onTouchTap={this._onHomeYClicked}
                        />
                        &nbsp;
                        <RaisedButton
                            label="Stop"
                            onTouchTap={this._onStopClicked}
                        />
                    </div>
                </div>
            </div>
        )
    }
}

export default class StatusMotors extends React.Component {
    constructor() {
        super();

        this.state = {
            // Motor metadata.
            metadata: {},
            // Motor readings.
            readings: {},
        }
    }

    componentWillMount() {
        let bus = this.props.bus;
        // TODO: If there are no readings for some time, clear state.
        this._subscription = bus.subscribe('status', ['motors'], _.throttle((message) => {
            this.setState({
                metadata: message.metadata,
                readings: message.motor,
            });
        }, 300));
    }

    componentWillUnmount() {
        this._subscription.stop();
    }

    render() {
        let readings, controller;
        if (_.isEmpty(this.state.readings)) {
            readings = (
                <div>
                    Waiting for readings from the motor driver…
                    <br/><br/>
                    <LinearProgress mode="indeterminate"  />
                </div>
            )
        } else {
            readings = (
                <div>
                    Current position: X: {this.state.readings.current_x}, Y: {this.state.readings.current_y}, F: {this.state.readings.current_f}<br/>
                    Requested position: X: {this.state.readings.next_x}, Y: {this.state.readings.next_y}, F: {this.state.readings.next_f}<br/>
                    <br/>
                </div>
            )

            controller = <MotorController bus={this.props.bus} readings={this.state.readings} />
        }

        return (
            <Card initiallyExpanded={true}>
                <CardHeader
                    title="Motor status"
                    subtitle="Status of motors as reported by the motor driver"
                    avatar={<Avatar>M</Avatar>}
                    actAsExpander={true}
                    showExpandableButton={true}
                />

                <CardText expandable={true}>
                    {readings}
                    {controller}
                </CardText>
            </Card>
        )
    }
}