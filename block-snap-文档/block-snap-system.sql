create table sys_user
(
    id              int auto_increment comment '主键ID'
        primary key,
    username        varchar(64)                        not null comment '用户名',
    password        varchar(255)                       not null comment '密码',
    nickname        varchar(64)                        null comment '昵称',
    phone           varchar(20)                        null comment '手机号',
    email           varchar(128)                       null comment '邮箱',
    remark          varchar(500)                       null comment '备注',
    last_login_ip   varchar(50)                        null comment '最后登录IP',
    last_login_time datetime                           null comment '最后登录时间',
    status          tinyint  default 1                 null comment '状态: 1正常, 0停用',
    is_deleted      tinyint  default 0                 null comment '逻辑删除: 0未删除, 1已删除',
    create_time     datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_time     datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '更新时间'
)
    comment '系统用户表';

create table sys_user_mark
(
    id          bigint auto_increment
        primary key,
    user_id     bigint                             not null comment '关联 sys_user.id',
    target_id   int                                not null comment '数据项对应的表项数据id（表名.id）例如 mod_snapshot的id/instance的id',
    target_type tinyint                            not null comment '对应数据项 1 INSTANCE 2 MOD 3 MODPACK 4 RESOURCE 5 SHADER 6 CONFIG',
    favorite    tinyint  default 0                 not null comment '是否收藏 0否 1是',
    note        varchar(512)                       null comment '备注',
    create_time datetime default CURRENT_TIMESTAMP not null,
    update_time datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP
)
    comment '用户收藏/备注标记';


