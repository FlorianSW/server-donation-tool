import EventEmitter from 'events';
import {Events, EventSource} from '../domain/events';

export class EventQueue extends EventEmitter implements Events, EventSource {
}
