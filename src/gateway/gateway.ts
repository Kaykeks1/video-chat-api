import { OnModuleInit } from "@nestjs/common";
import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer, ConnectedSocket } from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

type customMessage = {
  name: string
  message: string
}

const rooms = new Map();


@WebSocketGateway({
  cors: {
    origin: '*'
  }
})
export class MyGateway implements OnModuleInit {
  @WebSocketServer()
  server: Server;

  onModuleInit() {
    this.server.on('connection', (socket) => {
      console.log('connected at: ', new Date())
    })
  }

  @SubscribeMessage('newMessage')
  onNewMessage(@MessageBody() data: any) {
    this.server.emit('onMessage', {
      msg: 'New message',
      content: data,
    })
  }

  @SubscribeMessage('join_custom_room')
  onJoinCustomRoom(@MessageBody() data: string, @ConnectedSocket() socket: Socket) {
    const { name } = JSON.parse(data);
    if (rooms.has(name)) {
      const initialCapacity = [...rooms.get(name)].length;
      if (initialCapacity === 2) {
        const res = { message: `Maximum occupancy reached` };
        this.server.to(socket.id).emit("join_message", JSON.stringify(res));
        return;
      }
    }
    socket.join(name);
    if (!rooms.has(name)) {
      rooms.set(name, new Set([socket.id]));
    } else {
      rooms.get(name).add(socket.id);
    }
    const capacity = [...rooms.get(name)].length;
    const socketIds = [...rooms.get(name)];
    const res = { message: `Welcome to custom room: ${name}`, capacity, socketIds };
    this.server.to(socket.id).emit("join_message", JSON.stringify(res));
    if (capacity === 2) {
      const res = { message: `A new user: ${socket.id} has joined`, capacity, socketIds };
      this.server.to(socketIds[0]).emit("new_user_event", JSON.stringify(res));
      this.server.to(socketIds[1]).emit("new_user_event", JSON.stringify(res));
    }
  }

  @SubscribeMessage('send_custom_room')
  onSendCustomRoom(@MessageBody() data: any, @ConnectedSocket() socket: Socket) {
    const { name, message } = data
    this.server.to(name).emit("custom_message", message);
  }


  @SubscribeMessage('leave_custom_room')
  onLeaveCustomRoom(@MessageBody() data: string, @ConnectedSocket() socket: Socket) {
    const { name } = JSON.parse(data);
    socket.leave(name);
    if (rooms.has(name)) {
      rooms.get(name).delete(socket.id);
      const socketIds = [...rooms.get(name)];
      const capacity = [...rooms.get(name)].length;
      const res = { message: `A new user: ${socket.id} has left`, capacity, socketIds };
      this.server.to(socketIds[0]).emit("user_left_event", JSON.stringify(res));
    }
  }
}
