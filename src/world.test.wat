(module

  (memory $f_data (import "F" "data") 0)
  (memory $f_dirty (import "F" "dirty") 0)
  (global $f_id (import "F" "id") i32)

  (global $query_count (import "query" "default_count") (mut i32))
  (memory $query_data (import "query" "default_data") 0)
  (global $query_width (import "query" "default_width") (mut i32))

  (import "system" "callback" (func $callback (param i32)))

  (memory $world_dirty (import "world" "dirty") 0)
  (global $world_dirty_width (import "world" "dirty_width") (mut i32))

  (func (export "tick") (param $delta f32) (param $total f32)
    ;;
    (local $i i32)
    (local $o i32)
    (local $entity_index i32)
    (local $f_index i32)
    ;;
    (local.set $i (i32.const 0))
    ;; while (i < count)
    (loop
      (br_if 1 (i32.ge_u (local.get $i) (global.get $query_count)))
      (local.set
        $entity_index
        (i32.load $query_data (i32.mul (local.get $i) (i32.mul (global.get $query_width) (i32.const 4))))
      )
      (local.set
        $f_index
        (i32.load
          $query_data
          (i32.add
            (i32.const 4)
            (i32.mul (local.get $i) (i32.mul (global.get $query_width) (i32.const 4)))
          )
        )
      )
      ;; if (4294967295 !== entity_index);
      (if
        (i32.lt_u (local.get $entity_index) (i32.const 4294967295))
        (then
          ;;   f_data[f_index] += (total + i)
          (f32.store
            $f_data
            (i32.mul (local.get $f_index) (i32.const 4))
            (f32.add
              (f32.add (f32.load $f_data (i32.mul (local.get $i) (i32.const 4))) (local.get $delta))
              (f32.convert_i32_u (local.get $i))
            )
          )
          ;;   f_dirty[i >> 3] |= 1 << (i & 7)
          (i32.store8
            $f_dirty
            (i32.shr_u (local.get $i) (i32.const 3))
            (i32.or
              (i32.load8_u
                $f_dirty
                (i32.shr_u (local.get $i) (i32.const 3))
              )
              (i32.shl (i32.const 1) (i32.and (local.get $i) (i32.const 7)))
            )
          )
          ;; o = entity_index * world_dirty_width + f_id * 3 + 2
          (local.set
            $o
            (i32.add
              (i32.add
                (i32.mul
                  (local.get $entity_index)
                  (global.get $world_dirty_width)
                )
                (i32.mul
                  (global.get $f_id)
                  (i32.const 3)
                )
              )
              (i32.const 2)
            )
          )
          ;; world_dirty[o >> 3] |= 1 << (o & 7)
          (i32.store8
            $world_dirty
            (i32.shr_u (local.get $o) (i32.const 3))
            (i32.or
              (i32.load8_u
                $world_dirty
                (i32.shr_u (local.get $o) (i32.const 3))
              )
              (i32.shl (i32.const 1) (i32.and (local.get $o) (i32.const 7)))
            )
          )
          ;;   if (0 === (i & 1))
          (if
            (i32.eqz (i32.and (local.get $i) (i32.const 1)))
            (then
              ;; callback(i)
              (call $callback (local.get $i))
            )
          )
        )
      )
      ;;   i += 1;
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      ;;
      (br 0)
    )
  )
)