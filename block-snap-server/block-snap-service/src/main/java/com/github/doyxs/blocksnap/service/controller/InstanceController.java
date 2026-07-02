package com.github.doyxs.blocksnap.service.controller;

import com.github.doyxs.blocksnap.common.api.Result;
import com.github.doyxs.blocksnap.service.model.dto.InstanceFavoriteDTO;
import com.github.doyxs.blocksnap.service.model.dto.InstanceNoteDTO;
import com.github.doyxs.blocksnap.service.service.InstanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/svc-instance")
@RequiredArgsConstructor
public class InstanceController {

    private final InstanceService instanceService;

    @GetMapping("/list")
    public Result<Object> list(@RequestHeader("X-User-Id") Long userId) {
        return Result.success(instanceService.listByUserId(userId));
    }
    @PutMapping("/favorite")
    public Result<String> favorite(@RequestHeader("X-User-Id") Long userId, @RequestBody InstanceFavoriteDTO instanceFavoriteDTO) {
        instanceService.favorite(userId, instanceFavoriteDTO);
        return Result.success("修改成功");
    }
    @PutMapping("/note")
    public Result<String> note(@RequestHeader("X-User-Id") Long userId, @RequestBody InstanceNoteDTO instanceNoteDTO) {
        instanceService.note(userId, instanceNoteDTO);
        return Result.success("修改成功");
    }
    
}
