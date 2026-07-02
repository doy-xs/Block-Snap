package com.github.doyxs.blocksnap.service.controller;

import com.github.doyxs.blocksnap.common.api.Result;
import com.github.doyxs.blocksnap.service.model.dto.ModFavoriteDTO;
import com.github.doyxs.blocksnap.service.model.dto.ModNoteDTO;
import com.github.doyxs.blocksnap.service.service.ModService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/svc-mod")
@RequiredArgsConstructor
public class ModController {
    private final ModService modService;

    @GetMapping("/list")
    public Result<Object> list(@RequestHeader("X-User-Id") Long userId,
                               @RequestParam("instanceId") Integer instanceId) {
        return Result.success(modService.listByInstanceId(userId, instanceId));
    }
    @PutMapping("/favorite")
    public Result<String> favorite(@RequestHeader("X-User-Id") Long userId, @RequestBody ModFavoriteDTO modFavoriteDTO) {
        modService.favorite(userId, modFavoriteDTO);
        return Result.success("修改成功");
    }
    @PutMapping("/note")
    public Result<String> note(@RequestHeader("X-User-Id") Long userId, @RequestBody ModNoteDTO modNoteDTO) {
        modService.note(userId, modNoteDTO);
        return Result.success("修改成功");
    }
}
