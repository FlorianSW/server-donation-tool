import EventEmitter from 'events';
import {DonationEvents, EventSource} from '../domain/events';
import {singleton} from 'tsyringe';

@singleton()
export class EventQueue extends EventEmitter implements DonationEvents, EventSource {
    constructor() {
        super();
    }
}
