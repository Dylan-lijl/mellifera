import {ChannelInitializer} from "@/network_back/core/ChannelInitializer";
import type {QuicStreamChannel} from "@/network_back/quic/QuicStreamChannel";
import type {Channel} from "@/network_back/core/Channel";
import {MessageDecode} from "@/modules/service/handlers/MessageDecode";
import {MessageEncode} from "@/modules/service/handlers/MessageEncode";
import {ServerCommandDispatcher} from "@/modules/service/handlers/ServerCommandDispatcher";
import * as commandApi from '@/modules/service/controllers/client/command'
import {DatagramChannel} from "@/network_back/core/MessageChannel";

/**
 * 根据参数初始化客户端
 * 使用分发器解析指定的请求处理类
 * 根据channel和对方api创建动态代理对象
 * 访问认证信息,认证成功在创建数据连接
 * @param host
 * @param port
 * @param token
 */
async function clientDemo(host: string, port: number,token:string) {
    //启动命令连接
    const bootstrap = new Bootstrap();
    bootstrap.channel(QuicStreamChannel)
        .handler((ch) => {
            ch.pipeline()
                .addLast(new MessageDecode())
                .addLast(new MessageEncode())
                //设置响应handler
                .addLast(new ServerCommandDispatcher(commandApi))
        })
    const channelFuture = bootstrap.connect(host,port);
    const channel = await channelFuture.channel()
    channel.onClose(()=>{
        //xxxx
    })
    const sender  = createSender(channel,serverCommandApi);
    const res = await sender.user.auth({token});
    if(res?.data===true){

    }else{

    }
    //
    refreshMapping();
    //开启数据连接
    const dataBootstrap = new Bootstrap();
    bootstrap.channel(QuicStreamChannel||DatagramChannel)
        .handler((ch) => {
            ch.pipeline()
                .addLast(new MessageDecode())
                .addLast(new MessageEncode())
                //设置响应handler
                .addLast(new ServerCommandDispatcher(serverDataApi))
        })
    const dataChannelFuture = bootstrap.connect(host,port);
    const dataChannel = await channelFuture.channel()
    channel.onClose(()=>{
        //xxxx
    })
    const dataSender  = createSender(channel,serverDataApi);
    const dataRes = await sender.user.auth({token});
    if(res?.data===true){

    }else{

    }
    //xxxxx
}
async function serverDemo() {
    //启动命令连接
    const bootstrap = new ServetBootstrap();
    bootstrap.channel(QuicStreamChannel||DatagramChannel)
        .handler((ch) => {
            ch.pipeline()
                .addLast(new MessageDecode())
                .addLast(new MessageEncode())
                //设置响应handler
                .addLast(new ServerCommandDispatcher(commandApi))
        })
    const channelFuture = bootstrap.bind(host,port);
    const channel = await channelFuture.channel()
    channel.onClose(()=>{
        //xxxx
    })
    //xxxxx
}