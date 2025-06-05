(module

  (memory $data (import "Expiring" "data") 0)
  (memory $dirty (import "Expiring" "dirty") 0)
  (import "Expiring" "instances" (table $instances 0 externref))
  (import "Expiring" "callback" (func $callback (param i32) (param externref)))

  (func (export "tick") (param $delta f32) (param $total f32)
    ;;
    (local $i i32)
    (local $instance externref)
    (local $length i32)
    ;;
    (local.set $i (i32.const 0))
    (local.set $length (table.size $instances))
    ;;
    (loop
      ;; while (i < length)
      (br_if 1 (i32.ge_u (local.get $i) (local.get $length)))
      ;;   if (elapsed.total >= data[i * 4])
      (if
        (f32.ge
          (local.get $total)
          (f32.load (memory $data) (i32.mul (local.get $i) (i32.const 4)))
        )
        (then
          ;; callback(0, instances[i]): destroy instance entity
          (call $callback (i32.const 0) (table.get $instances (local.get $i)))
        )
      )
      ;;   i += 1;
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      ;;
      (br 0)
    )
  )
)