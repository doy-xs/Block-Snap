create table instance
(
    id              int auto_increment comment '实例 id'
        primary key,
    user_id         bigint                             not null comment '关联 sys_user.id',
    modpack_info_id bigint                             null comment '关联modpack_info.id',
    client_key      varchar(64)                        not null comment 'Mod 传的实例指纹(目录hash/启动器UUID)',
    name            varchar(128)                       not null comment '用户可改;NULL时前端回退目录名',
    is_deleted      tinyint  default 0                 not null comment '逻辑删除',
    create_time     datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_time     datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '修改时间'
)
    comment '实例表';

create table mod_info
(
    id          int auto_increment comment '模组id'
        primary key,
    name        varchar(256)                       null comment '模组名称',
    hash        varchar(500)                       not null comment 'mod哈希值',
    platform    tinyint                            not null comment '来源平台 1 CURSEFORGE 2 MODRINTH',
    version     varchar(32)                        null comment '最新版本号',
    url         varchar(500)                       null,
    icon        varchar(300)                       null,
    create_time datetime default CURRENT_TIMESTAMP not null comment '创建时间',
    update_time datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP comment '修改时间'
)
    comment '模组表';

create table mod_snapshot
(
    id          int auto_increment
        primary key,
    snapshot_id int                                not null comment '关联snapshot.id',
    mod_info_id int                                null comment '关联mod_info.id',
    version     varchar(50)                        null comment '模组版本',
    mod_hash    varchar(300)                       null comment '该快照下 mod 的 SHA-256',
    load_time   bigint                             null comment '加载耗时(ms)',
    is_deleted  tinyint  default 0                 null comment '0=活跃 1=已移除 2=禁用',
    added_time  datetime                           null comment '模组添加时间',
    update_time datetime                           null comment '模组修改时间',
    create_time datetime default CURRENT_TIMESTAMP not null comment '表创建时间'
)
    comment '快照->模组表';

create table modpack_info
(
    id          int auto_increment comment '内部主键'
        primary key,
    platform    tinyint                            not null comment '来源平台 1 MODRINTH 2  CURSEFORGE 2 FTB 3 TECHNIC',
    modpack_id  int                                not null comment '平台整合包项目 ID（CF modId / MR project_id / FTB pack_id）',
    name        varchar(128)                       null comment '整合包名称',
    version     varchar(64)                        null comment '最新版本号',
    version_id  int                                null comment '最新版本在平台上的 ID（CF fileId / MR version_id）',
    create_time datetime default CURRENT_TIMESTAMP not null,
    update_time datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP
)
    comment '整合包全局主数据（平台项目级）';

create table snapshot
(
    id             int auto_increment comment '快照 id'
        primary key,
    instance_id    int                                not null comment '关联 instance.id',
    mc_version     varchar(32)                        null comment '该次启动 MC 版本',
    loader_type    tinyint                            null comment '加载类型 1 FABRIC 2 FORGE 3 NEOFORGE 4 QUILT',
    loader_version varchar(32)                        null comment '加载器版本',
    java_version   varchar(32)                        null comment 'Java 版本',
    load_ms        int                                null comment '加载耗时(ms)',
    snapshot_time  datetime                           not null comment '快照采集/游戏启动时间',
    create_time    datetime default CURRENT_TIMESTAMP not null,
    update_time    datetime default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP
)
    comment '实例快照表头';


