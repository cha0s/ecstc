(module

  (memory $data (import "Spring" "data") 0)
  (memory $dirty (import "Spring" "dirty") 0)
  (import "Spring" "instances" (table $instances 0 externref))
  (import "Spring" "callback" (func $callback (param i32) (param externref)))

  (func (export "tick") (param $delta f32) (param $total f32)
    ;;
    (local $i i32)
    (local $j i32)
    (local $d i32)
    (local $p f32)
    (local $v f32)
    (local $instance externref)
    (local $length i32)
    ;;
    (local.set $i (i32.const 0))
    ;; (local.set $j (i32.const 0))
    (local.set $length (table.size $instances))
    ;;
    (loop
      ;; while (i < length)
      (br_if 1 (i32.ge_u (local.get $i) (local.get $length)))
      ;; d = 0
      (local.set $d (i32.const 0))
      ;; j = i * 24
      (local.set $j (i32.mul (local.get $i) (i32.const 24)))
      ;; v = ((F_spring + F_damp) / mass) * delta;
      (
        local.set
        $v
        (f32.mul
          (f32.div
            (f32.add
              ;; F_spring = -stiffness * point
              (f32.mul
                (f32.neg (f32.load $data (i32.add (local.get $j) (i32.const 16))))
                (f32.load $data (i32.add (local.get $j) (i32.const 12)))
              )
              ;; F_damp = -damping * velocity
              (f32.mul
                (f32.neg (f32.load $data (i32.add (local.get $j) (i32.const 4))))
                (f32.load $data (i32.add (local.get $j) (i32.const 20)))
              )
            )
            (f32.load $data (i32.add (local.get $j) (i32.const 8)))
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
            $data
            (i32.add (local.get $j) (i32.const 20))
            (f32.add
              (f32.load $data (i32.add (local.get $j) (i32.const 20)))
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
          (f32.load $data (i32.add (local.get $j) (i32.const 20)))
          (local.get $delta)
        )
      )
      ;; if (Math.abs(p) > 0.001)
      (if
        (f32.gt (f32.abs (local.get $p)) (f32.const 0.001))
        (then
          ;; Spring.point += p;
          (f32.store
            $data
            (i32.add (local.get $j) (i32.const 12))
            (f32.add
              (f32.load $data (i32.add (local.get $j) (i32.const 12)))
              (local.get $p)
            )
          )
          (local.set $d (i32.or (local.get $d) (i32.const 8)))
        )
      )
      (i32.store8 $dirty (local.get $i) (local.get $d))
      ;;   i += 1;
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      ;;
      (br 0)
    )
  )
)