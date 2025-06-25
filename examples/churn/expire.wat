(module

  (memory $data (import "Expiring" "data") 0)
  (memory $dirty (import "Expiring" "dirty") 0)
  (global $length (import "Expiring" "length") (mut i32))
  (import "system" "destroy" (func $destroy (param i32)))

  (func (export "tick") (param $delta f32) (param $total f32)
    ;;
    (local $i i32)
    (local $instance externref)
    ;;
    (local.set $i (i32.const 0))
    ;;
    (loop
      ;; while (i < length)
      (br_if 1 (i32.ge_u (local.get $i) (global.get $length)))
      ;;   if (elapsed.total >= data[i * 4])
      (if
        (f32.ge
          (local.get $total)
          (f32.load (memory $data) (i32.mul (local.get $i) (i32.const 4)))
        )
        (then
          ;; destroy(i): destroy instance entity
          (call $destroy (local.get $i))
        )
      )
      ;;   i += 1;
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      ;;
      (br 0)
    )
  )
)