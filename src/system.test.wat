(module

  (memory $a_data (import "A" "data") 0)
  (memory $a_dirty (import "A" "dirty") 0)
  (global $a_id (import "A" "id") i32)

  (global $query_count (import "query" "withA_count") (mut i32))
  (memory $query_data (import "query" "withA_data") 0)
  (global $query_width (import "query" "withA_width") (mut i32))

  (memory $world_dirty (import "world" "dirty") 0)
  (global $world_dirty_width (import "world" "dirty_width") (mut i32))

  (func (export "tick") (param $delta f32) (param $total f32)
    ;;
    (local $i i32)
    (local $o i32)
    (local $entity_index i32)
    (local $a_index i32)
    (local $j i32)
    ;;
    (local.set $i (i32.const 0))
    ;;
    (loop
      ;; while (i < query_count)
      (br_if 1 (i32.ge_u (local.get $i) (i32.sub (global.get $query_count) (i32.const 1))))
      ;; entity_index = query_data[i * query_width * 4]
      (local.set
        $entity_index
        (i32.load
          $query_data
          (i32.mul (local.get $i) (i32.mul (global.get $query_width) (i32.const 4)))
        )
      )
      (if
        (i32.lt_u (local.get $entity_index) (i32.const 4294967295)) ;; QUERY_DEINDEX_VALUE
        (then
          ;; a_index = query_data[i * query_width * 4 + 4]
          (local.set
            $a_index
            (i32.load
              $query_data
              (i32.add
                (i32.mul (local.get $i) (i32.mul (global.get $query_width) (i32.const 4)))
                (i32.const 4)
              )
            )
          )
          ;; a_data[i] = 25
          (i32.store8
            $a_data
            (local.get $i)
            (i32.const 25)
          )
          ;; a_dirty[i >> 3] |= 1 << (i & 7)
          (i32.store8
            $a_dirty
            (i32.shr_u (local.get $a_index) (i32.const 3))
            (i32.or
              (i32.load8_u
                $a_dirty
                (i32.shr_u (local.get $a_index) (i32.const 3))
              )
              (i32.shl (i32.const 1) (i32.and (local.get $a_index) (i32.const 7)))
            )
          )
          ;; o = entity_index * world_dirty_width + a_id * 3
          (local.set
            $o
            (i32.add
              (i32.mul
                (local.get $entity_index)
                (global.get $world_dirty_width)
              )
              (i32.mul
                (global.get $a_id)
                (i32.const 3)
              )
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
          ;; o += 1
          (local.set $o (i32.add (local.get $o) (i32.const 1)))
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
        )
      )
      ;; i += 1;
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      ;;
      (br 0)
    )
  )
)