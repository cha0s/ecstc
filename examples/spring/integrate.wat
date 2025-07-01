(module

  (memory $spring_data (import "Spring" "data") 0)
  (memory $spring_dirty (import "Spring" "dirty") 0)
  (global $spring_id (import "Spring" "id") i32)

  (global $query_count (import "query" "default_count") (mut i32))
  (memory $query_data (import "query" "default_data") 0)
  (global $query_width (import "query" "default_width") (mut i32))

  (memory $world_dirty (import "world" "dirty") 0)
  (global $world_dirty_width (import "world" "dirty_width") (mut i32))

  (func (export "tick") (param $delta f32) (param $total f32)
    ;;
    (local $i i32)
    (local $o i32)
    (local $entity_index i32)
    (local $spring_index i32)
    (local $j i32)
    (local $d i32)
    (local $p f32)
    (local $v f32)
    (local $instance externref)
    ;;
    (local.set $i (i32.const 0))
    ;;
    (loop
      ;; while (i < query_count)
      (br_if 1 (i32.ge_u (local.get $i) (global.get $query_count)))
      ;; entity_index = query_data[i * query_width * 4]
      (local.set
        $entity_index
        (i32.load $query_data (i32.mul (local.get $i) (i32.mul (global.get $query_width) (i32.const 4))))
      )
      (if
        (i32.lt_u (local.get $entity_index) (i32.const 4294967295))
        (then
          ;; entity_index = query_data[i * query_width * 4 + 4]
          (local.set
            $spring_index
            (i32.load
              $query_data
              (i32.add
                (i32.mul (local.get $i) (i32.mul (global.get $query_width) (i32.const 4)))
                (i32.const 4)
              )
            )
          )
          ;; d = 0
          (local.set $d (i32.const 0))
          ;; j = i * 24
          (local.set $j (i32.mul (local.get $spring_index) (i32.const 24)))
          ;; v = ((F_spring + F_damp) / mass) * delta;
          (
            local.set
            $v
            (f32.mul
              (f32.div
                (f32.add
                  ;; F_spring = -stiffness * point
                  (f32.mul
                    (f32.neg (f32.load $spring_data (i32.add (local.get $j) (i32.const 16))))
                    (f32.load $spring_data (i32.add (local.get $j) (i32.const 12)))
                  )
                  ;; F_damp = -damping * velocity
                  (f32.mul
                    (f32.neg (f32.load $spring_data (i32.add (local.get $j) (i32.const 4))))
                    (f32.load $spring_data (i32.add (local.get $j) (i32.const 20)))
                  )
                )
                (f32.load $spring_data (i32.add (local.get $j) (i32.const 8)))
              )
              (local.get $delta)
            )
          )
          ;; if (Math.abs(v) > 0.001)
          (if
            (f32.gt (f32.abs (local.get $v)) (f32.const 0.001))
            (then
              ;; Spring.velocity += v
              (f32.store
                $spring_data
                (i32.add (local.get $j) (i32.const 20))
                (f32.add
                  (f32.load $spring_data (i32.add (local.get $j) (i32.const 20)))
                  (local.get $v)
                )
              )
              (local.set $d (i32.or (local.get $d) (i32.const 32)))
            )
          )
          ;; p = Spring.velocity * delta;
          (local.set
            $p
            (f32.mul
              (f32.load $spring_data (i32.add (local.get $j) (i32.const 20)))
              (local.get $delta)
            )
          )
          ;; if (Math.abs(p) > 0.001)
          (if
            (f32.gt (f32.abs (local.get $p)) (f32.const 0.001))
            (then
              ;; Spring.point += p;
              (f32.store
                $spring_data
                (i32.add (local.get $j) (i32.const 12))
                (f32.add
                  (f32.load $spring_data (i32.add (local.get $j) (i32.const 12)))
                  (local.get $p)
                )
              )
              (local.set $d (i32.or (local.get $d) (i32.const 8)))
            )
          )
          ;;   spring_dirty[i >> 3] |= 1 << (i & 7)
          (i32.store8
            $spring_dirty
            (i32.shr_u (i32.mul (local.get $spring_index) (i32.const 6)) (i32.const 3))
            (i32.or
              (i32.load8_u
                $spring_dirty
                (i32.shr_u (i32.mul (local.get $spring_index) (i32.const 6)) (i32.const 3))
              )
              (local.get $d)
            )
          )
          ;; o = entity_index * world_dirty_width + spring_id * 2
          (local.set
            $o
            (i32.add
              (i32.add
                (i32.mul
                  (local.get $entity_index)
                  (global.get $world_dirty_width)
                )
                (i32.mul
                  (global.get $spring_id)
                  (i32.const 2)
                )
              )
              (i32.const 0)
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
        )
      )
      ;;   i += 1;
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      ;;
      (br 0)
    )
  )
)