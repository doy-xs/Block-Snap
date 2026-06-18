package com.github.doyxs.blocksnap.service.controller;

import com.github.doyxs.blocksnap.common.api.Result;
import com.github.doyxs.blocksnap.service.model.entity.ModInfo;
import com.github.doyxs.blocksnap.service.model.vo.ModDetailVO;
import com.github.doyxs.blocksnap.service.service.IModService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/svc-mod")
public class ModController {

    @Autowired
    private IModService modService;

    /**
     * 查询模组全局表 mod_info 全量列表。
     */
    @GetMapping("/info")
    public Result<List<ModInfo>> listModInfo() {
        return Result.success(modService.listModInfo());
    }

    /**
     * 按主键查询单条模组主数据。
     */
    @GetMapping("/info/{id}")
    public Result<ModInfo> getModInfo(@PathVariable Integer id) {
        return Result.success(modService.getModInfoById(id));
    }

    /**
     * 按 snapshotId 查询该次快照下的模组列表（mod_snapshot JOIN mod_info）。
     */
    @GetMapping("/snapshot/{snapshotId}")
    public Result<List<ModDetailVO>> listModsBySnapshot(@PathVariable Integer snapshotId,
                                                        @RequestParam(defaultValue = "false") boolean includeDeleted) {
        return Result.success(modService.listModsBySnapshotId(snapshotId, includeDeleted));
    }
}
