package com.github.doyxs.blocksnap.common.constant;

import java.util.Set;

/**
 * 用户标记（sys_user_mark）目标类型。
 * <p>
 * {@code target_id} 为对应表主键，例如 instance.id、mod_snapshot.id、modpack_info.id。
 */
public final class MarkConst {

    private MarkConst() {}

    /** 游戏实例 instance.id */
    public static final int TARGET_TYPE_INSTANCE = 1;
    /** 模组 mod_snapshot.id */
    public static final int TARGET_TYPE_MOD = 2;
    /** 整合包 modpack_info.id */
    public static final int TARGET_TYPE_MODPACK = 3;
    /** 资源包 mod_snapshot.id */
    public static final int TARGET_TYPE_RESOURCE = 4;
    /** 光影包 mod_snapshot.id */
    public static final int TARGET_TYPE_SHADER = 5;
    /** 配置文件 mod_snapshot.id */
    public static final int TARGET_TYPE_CONFIG = 6;

    /** 合法的 targetType 取值集合（1~6） */
    public static final Set<Integer> TARGET_TYPES = Set.of(
            TARGET_TYPE_INSTANCE,
            TARGET_TYPE_MOD,
            TARGET_TYPE_MODPACK,
            TARGET_TYPE_RESOURCE,
            TARGET_TYPE_SHADER,
            TARGET_TYPE_CONFIG
    );

    public static boolean isValidTargetType(Integer targetType) {
        return targetType != null && TARGET_TYPES.contains(targetType);
    }
}
